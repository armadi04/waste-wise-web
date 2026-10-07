import { expect, it, mock } from 'bun:test';
import { PortalCampaignCatalogService } from '@/portal/campaigns/portal-campaign-catalog.service';
import { PortalOrderItemAdminService } from '@/portal/admin/portal-admin.service';
import type { Repository } from 'typeorm';
import type { PortalOrderItem } from '@/portal/commerce/entities/portal-order-item.entity';
import type { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';

it('serializes catalog and detail using the same reward rules and eligible product links', async () => {
  const campaign = {
    id: 1,
    slug: 'test',
    rewardLabel: 'Outdated label',
    rules: {
      startsAt: '2026-01-01T00:00:00Z',
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [7],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 25000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  };
  const coupons = mock(() =>
    Promise.resolve([{ id: 7, slug: 'dinner', title: 'Dinner' }]),
  );
  const service = Object.assign(
    Object.create(PortalCampaignCatalogService.prototype),
    {
      campaignRepository: {
        findAndCount: () => Promise.resolve([[campaign], 1]),
        findOneBy: () => Promise.resolve(campaign),
      },
      couponRepository: { find: coupons },
      eventRepository: { find: mock(() => Promise.resolve([])) },
    },
  ) as PortalCampaignCatalogService;
  const list = await service.listCampaigns({ page: 1, limit: 24 });
  const detail = await service.getCampaign('test');
  expect(list.data[0]).toEqual(detail);
  expect(detail.rewardLabel).not.toBe('Outdated label');
  expect(detail.eligibleProducts).toEqual([
    { kind: 'coupon', slug: 'dinner', title: 'Dinner' },
  ]);
  expect(coupons).toHaveBeenCalledTimes(2);
});

it('rejects generic order-item creation before any write can change checkout provenance', async () => {
  const save = mock(() => Promise.resolve({}));
  const service = new PortalOrderItemAdminService(
    { save } as unknown as Repository<PortalOrderItem>,
    {} as Repository<PortalOrder>,
  );
  await expect(service.create({ orderId: 1 })).rejects.toThrow('checkout');
  expect(save).not.toHaveBeenCalled();
});
