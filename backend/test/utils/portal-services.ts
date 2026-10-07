import { PortalService } from '@/portal/portal.service';
import { PortalCatalogService } from '@/portal/catalog/portal-catalog.service';
import { PortalReviewsService } from '@/portal/reviews/portal-reviews.service';
import { PortalCustomerService } from '@/portal/customer/portal-customer.service';
import { PortalGiftsService } from '@/portal/gifts/portal-gifts.service';
import { PortalBookingsService } from '@/portal/bookings/portal-bookings.service';
import { PortalPassesService } from '@/portal/passes/portal-passes.service';
import { PortalCommerceService } from '@/portal/commerce/portal-commerce.service';
import { PortalCampaignCatalogService } from '@/portal/campaigns/portal-campaign-catalog.service';

/** Wires domain instances to the explicit dependencies supplied by integration fixtures. */
export function createPortalServiceFixture(
  dependencies: Record<string, unknown>,
): PortalService {
  const fixture = <T extends object>(prototype: T): T =>
    Object.assign(Object.create(prototype) as T, dependencies);
  const reviews = fixture(PortalReviewsService.prototype);
  const catalog = Object.assign(fixture(PortalCatalogService.prototype), {
    reviews,
  });
  return new PortalService(
    catalog,
    reviews,
    fixture(PortalCustomerService.prototype),
    fixture(PortalGiftsService.prototype),
    fixture(PortalBookingsService.prototype),
    fixture(PortalPassesService.prototype),
    fixture(PortalCommerceService.prototype),
    fixture(PortalCampaignCatalogService.prototype),
  );
}
