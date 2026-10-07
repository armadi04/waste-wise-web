import { describe, expect, it, spyOn } from 'bun:test';
import { compilePortalModule } from '../../utils/portal-module';
import { PortalService } from '@/portal/portal.service';
import { PortalCatalogService } from '@/portal/catalog/portal-catalog.service';
import { PortalReviewsService } from '@/portal/reviews/portal-reviews.service';
import { PortalCustomerService } from '@/portal/customer/portal-customer.service';
import { PortalGiftsService } from '@/portal/gifts/portal-gifts.service';
import { PortalBookingsService } from '@/portal/bookings/portal-bookings.service';
import { PortalPassesService } from '@/portal/passes/portal-passes.service';
import { PortalCommerceService } from '@/portal/commerce/portal-commerce.service';
import { PortalCampaignCatalogService } from '@/portal/campaigns/portal-campaign-catalog.service';

describe('PortalModule dependency wiring', () => {
  it('resolves real domain services and delegates through the registered instance', async () => {
    const module = await compilePortalModule();
    try {
      for (const service of [
        PortalCatalogService,
        PortalReviewsService,
        PortalCustomerService,
        PortalGiftsService,
        PortalBookingsService,
        PortalPassesService,
        PortalCommerceService,
        PortalCampaignCatalogService,
      ]) {
        expect(module.get(service)).toBeInstanceOf(service);
      }
      const catalog = module.get(PortalCatalogService);
      const result = { data: [], meta: { page: 1, limit: 10, total: 0 } };
      const delegate = spyOn(catalog, 'listCoupons').mockResolvedValue(
        result as never,
      );
      try {
        expect(await module.get(PortalService).listCoupons({})).toBe(result);
        expect(delegate).toHaveBeenCalledWith({});
      } finally {
        delegate.mockRestore();
      }
    } finally {
      await module.close();
    }
  });
});
