import { describe, expect, it } from 'bun:test';
import { DEMO_CAMPAIGN_SEEDS } from '@/portal/seed/portal-campaign-seed.data';
import { PortalSeedService } from '@/portal/seed/portal-seed.service';

describe('local campaign fixtures', () => {
  it('provides twenty distinct complete campaigns within entity constraints', () => {
    expect(DEMO_CAMPAIGN_SEEDS).toHaveLength(20);
    expect(new Set(DEMO_CAMPAIGN_SEEDS.map((seed) => seed.slug)).size).toBe(20);
    expect(
      new Set(DEMO_CAMPAIGN_SEEDS.map((seed) => seed.targetPoints)).size,
    ).toBeGreaterThan(10);
    expect(new Set(DEMO_CAMPAIGN_SEEDS.map((seed) => seed.imageUrl)).size).toBe(
      5,
    );
    for (const seed of DEMO_CAMPAIGN_SEEDS) {
      expect(seed.slug).toMatch(/^demo-[a-z0-9-]+$/);
      expect(seed.slug.length).toBeLessThanOrEqual(160);
      expect(seed.title.startsWith('[Demo]')).toBe(true);
      expect(seed.title.length).toBeLessThanOrEqual(180);
      expect(seed.description).toContain('Data simulasi lokal');
      expect(seed.rewardLabel.length).toBeGreaterThan(0);
      expect(seed.rewardLabel.length).toBeLessThanOrEqual(120);
      expect(new URL(seed.imageUrl).protocol).toBe('https:');
      expect(seed.imageUrl.length).toBeLessThanOrEqual(255);
      expect(Number.isInteger(seed.targetPoints)).toBe(true);
      expect(seed.targetPoints).toBeGreaterThan(0);
      expect(seed.active).toBe(true);
    }
  });

  it('preserves existing campaigns and the original demo identity across reruns', async () => {
    const rows: Array<Record<string, unknown>> = [];
    const campaigns = {
      create: (data: Record<string, unknown>) => ({ ...data }),
      findOneBy: async (where: { slug: string }) =>
        rows.find((row) => row.slug === where.slug),
      save: async (data: Record<string, unknown>) => {
        const row = { ...data, id: rows.length + 1 };
        rows.push(row);
        return row;
      },
    };
    // No progress repository: catalog seeding must not mutate user progress.
    const service = Object.assign(Object.create(PortalSeedService.prototype), {
      campaigns,
    }) as {
      seedCampaign: () => Promise<Record<string, unknown>>;
    };
    const original = await service.seedCampaign();
    expect(original.slug).toBe('demo');
    expect(rows).toHaveLength(21);
    rows[1].title = 'Edited locally';
    rows[1].active = false;
    rows[1].targetPoints = 999;
    expect(await service.seedCampaign()).toBe(original);
    expect(rows).toHaveLength(21);
    expect(rows[1].title).toBe('Edited locally');
    expect(rows[1].active).toBe(false);
    expect(rows[1].targetPoints).toBe(999);
  });
});
