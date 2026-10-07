import { describe, expect, it } from 'bun:test';
import { PortalCatalogService } from '@/portal/catalog/portal-catalog.service';

type CategoryRow = {
  name: string;
  count: string;
  slug?: string | null;
  label?: string | null;
  blurb?: string | null;
  icon?: string | null;
  position?: number | null;
  featured?: boolean | null;
};

function serviceWithRows(rows: CategoryRow[]) {
  const calls: Array<[string, unknown[]]> = [];
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  const builder = {
    innerJoin: chain('innerJoin'),
    select: chain('select'),
    addSelect: chain('addSelect'),
    where: chain('where'),
    andWhere: chain('andWhere'),
    groupBy: chain('groupBy'),
    addGroupBy: chain('addGroupBy'),
    orderBy: chain('orderBy'),
    addOrderBy: chain('addOrderBy'),
    getRawMany: () => Promise.resolve(rows),
  };
  const service = Object.create(
    PortalCatalogService.prototype,
  ) as PortalCatalogService;
  Object.assign(service, {
    couponRepository: { createQueryBuilder: () => builder },
  });
  return { service, calls };
}

describe('PortalCatalogService.listCouponCategories', () => {
  it('returns active category labels with counts and curated metadata', async () => {
    const { service, calls } = serviceWithRows([
      {
        name: 'Kuliner malam',
        count: '8',
        slug: 'kuliner-malam',
        label: 'Makan',
        blurb: 'Meja malam.',
        icon: 'utensils',
        position: 1,
        featured: true,
      },
      { name: 'Musik', count: '2' },
    ]);

    expect(await service.listCouponCategories({})).toEqual([
      {
        name: 'Kuliner malam',
        count: 8,
        slug: 'kuliner-malam',
        label: 'Makan',
        blurb: 'Meja malam.',
        icon: 'utensils',
        position: 1,
        featured: true,
      },
      {
        name: 'Musik',
        count: 2,
        slug: null,
        label: null,
        blurb: null,
        icon: null,
        position: null,
        featured: false,
      },
    ]);
    // Every coupon has a category now: chips come from the category row itself.
    expect(calls).toContainEqual(['andWhere', ['category.active = true']]);
    expect(calls).toContainEqual(['select', ['category.name', 'name']]);
    expect(calls.some(([method]) => method === 'innerJoin')).toBe(true);
    expect(calls).toContainEqual(['where', ['coupon.active = true']]);
    expect(
      calls.some(([, args]) => String(args[0]).includes('coupon.city')),
    ).toBe(false);
  });

  it('scopes the counts to a city when requested', async () => {
    const { service, calls } = serviceWithRows([]);

    await service.listCouponCategories({ city: 'Bandung' });

    expect(calls).toContainEqual([
      'andWhere',
      ['coupon.city = :city', { city: 'Bandung' }],
    ]);
  });
});
