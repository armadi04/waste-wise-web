import { describe, expect, it, mock } from 'bun:test';
import { PortalService } from '@/portal/portal.service';
import type { CouponCatalogQueryDto } from '@/portal/catalog/dto/coupon-catalog-query.dto';

function fixture(catalog: unknown) {
  return new PortalService(
    catalog as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

describe('PortalService facade', () => {
  it('delegates to the injected catalog instance and preserves query and result', async () => {
    const result = { data: [{ slug: 'dinner' }], meta: { total: 1 } };
    const listCoupons = mock(() => Promise.resolve(result));
    const facade = fixture({ listCoupons });
    const query = {} as CouponCatalogQueryDto;
    await expect(facade.listCoupons(query)).resolves.toBe(result);
    expect(listCoupons).toHaveBeenCalledWith(query);
  });

  it('propagates the domain error unchanged', async () => {
    const error = new Error('Catalog unavailable');
    const facade = fixture({ listCoupons: () => Promise.reject(error) });
    await expect(facade.listCoupons({} as CouponCatalogQueryDto)).rejects.toBe(
      error,
    );
  });
});
