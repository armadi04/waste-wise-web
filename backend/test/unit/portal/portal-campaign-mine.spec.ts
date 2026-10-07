import { describe, expect, it, mock } from 'bun:test';
import type { DataSource } from 'typeorm';
import { PortalCampaignService } from '@/portal/campaigns/portal-campaign.service';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';
import { PortalCampaignProgress } from '@/portal/campaigns/entities/portal-campaign-progress.entity';
import { PortalPromoCode } from '@/portal/commerce/entities/portal-promo-code.entity';

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

const campaigns = [
  {
    id: 1,
    slug: 'fresh',
    title: 'Fresh',
    rewardLabel: 'Stored label',
    imageUrl: 'https://cdn.test/fresh.jpg',
    targetPoints: 100,
    rules: null,
  },
  {
    id: 2,
    slug: 'joined',
    title: 'Joined',
    rewardLabel: 'Outdated label',
    imageUrl: 'https://cdn.test/joined.jpg',
    targetPoints: 50,
    rules: {
      reward: {
        kind: 'fixed',
        value: 25000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    id: 3,
    slug: 'used',
    title: 'Used',
    rewardLabel: 'Used label',
    imageUrl: 'https://cdn.test/used.jpg',
    targetPoints: 10,
    rules: null,
  },
];

const progressRows = [
  {
    campaignId: 2,
    userId: 7,
    points: 60,
    targetPoints: 50,
    status: 'eligible',
  },
  { campaignId: 3, userId: 7, points: -4, targetPoints: 10, status: 'active' },
];

const promos = [
  {
    campaignId: 2,
    ownerUserId: 7,
    code: 'CMP-OPEN',
    active: true,
    consumedAt: null,
    revokedAt: null,
    reservedOrderId: null,
    expiresAt: future,
  },
  {
    campaignId: 3,
    ownerUserId: 7,
    code: 'CMP-USED',
    active: true,
    consumedAt: past,
    revokedAt: null,
    reservedOrderId: null,
    expiresAt: future,
  },
];

function serviceWith(rows = campaigns, total = rows.length) {
  const campaignRepository = {
    findAndCount: mock(() => Promise.resolve([rows, total])),
    findOneBy: mock(({ slug }: { slug: string }) =>
      Promise.resolve(rows.find((row) => row.slug === slug) ?? null),
    ),
  };
  const progressRepository = {
    find: mock(() => Promise.resolve(progressRows)),
    findOneBy: mock(({ campaignId }: { campaignId: number }) =>
      Promise.resolve(
        progressRows.find((row) => row.campaignId === campaignId) ?? null,
      ),
    ),
  };
  const promoRepository = {
    find: mock(() => Promise.resolve(promos)),
    findOneBy: mock(({ campaignId }: { campaignId: number }) =>
      Promise.resolve(
        promos.find((row) => row.campaignId === campaignId) ?? null,
      ),
    ),
  };
  const repositories = new Map<unknown, unknown>([
    [PortalCampaign, campaignRepository],
    [PortalCampaignProgress, progressRepository],
    [PortalPromoCode, promoRepository],
  ]);
  const dataSource = {
    getRepository: (entity: unknown) => repositories.get(entity),
  } as unknown as DataSource;
  return {
    service: new PortalCampaignService(dataSource),
    campaignRepository,
    progressRepository,
    promoRepository,
  };
}

describe('PortalCampaignService.mine', () => {
  it('lists every active campaign with the caller progress and paging meta', async () => {
    const { service, campaignRepository } = serviceWith(campaigns, 30);
    const result = await service.mine(7, 2, 3);

    expect(campaignRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { active: true },
        skip: 3,
        take: 3,
      }),
    );
    expect(result.meta).toEqual({ total: 30, page: 2, lastPage: 10 });
    expect(result.data.map((item) => [item.slug, item.participating])).toEqual([
      ['fresh', false],
      ['joined', true],
      ['used', true],
    ]);
  });

  it('reports zero progress for campaigns the user has not touched', async () => {
    const { service } = serviceWith();
    const [fresh] = (await service.mine(7, 1, 24)).data;
    expect(fresh).toEqual({
      slug: 'fresh',
      title: 'Fresh',
      rewardLabel: 'Stored label',
      imageUrl: 'https://cdn.test/fresh.jpg',
      participating: false,
      progress: {
        points: 0,
        targetPoints: 100,
        status: 'pending',
        eligible: false,
        reward: null,
      },
    });
  });

  it('derives reward labels from rules and hides spent promo codes', async () => {
    const { service } = serviceWith();
    const [, joined, used] = (await service.mine(7, 1, 24)).data;
    expect(joined.rewardLabel).toBe('Diskon checkout Rp25.000');
    expect(joined.progress).toMatchObject({
      points: 60,
      eligible: true,
      reward: { status: 'available', code: 'CMP-OPEN' },
    });
    expect(used.progress.points).toBe(0);
    expect(used.progress.reward).toMatchObject({ status: 'used', code: null });
  });

  it('skips progress lookups when no campaign is active', async () => {
    const { service, progressRepository, promoRepository } = serviceWith([], 0);
    const result = await service.mine(7, 1, 24);
    expect(result).toEqual({
      data: [],
      meta: { total: 0, page: 1, lastPage: 1 },
    });
    expect(progressRepository.find).not.toHaveBeenCalled();
    expect(promoRepository.find).not.toHaveBeenCalled();
  });

  it('keeps the single-campaign progress shape identical to the list entry', async () => {
    const { service } = serviceWith();
    const list = await service.mine(7, 1, 24);
    expect(await service.progress(7, 'joined')).toEqual(list.data[1].progress);
  });
});
