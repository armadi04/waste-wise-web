import { PortalCatalogService } from '@/portal/catalog/portal-catalog.service';
import { PortalReviewsService } from '@/portal/reviews/portal-reviews.service';
import { PortalCustomerService } from '@/portal/customer/portal-customer.service';
import { PortalGiftsService } from '@/portal/gifts/portal-gifts.service';
import { PortalBookingsService } from '@/portal/bookings/portal-bookings.service';
import { PortalPassesService } from '@/portal/passes/portal-passes.service';
import { PortalCommerceService } from '@/portal/commerce/portal-commerce.service';
import { PortalCampaignCatalogService } from '@/portal/campaigns/portal-campaign-catalog.service';
import { PortalCommerceOutbox } from '@/portal/commerce/entities/portal-commerce-outbox.entity';
import { PortalPaymentExpiryService } from '@/portal/commerce/portal-payment-expiry.service';
import { PortalCampaignReconciliationService } from '@/portal/campaigns/portal-campaign-reconciliation.service';
import { PortalCampaignService } from '@/portal/campaigns/portal-campaign.service';
import { PortalCampaignLedger } from '@/portal/campaigns/entities/portal-campaign-ledger.entity';
import { PortalReferral } from '@/portal/campaigns/entities/portal-referral.entity';
import { TimeZoneController } from '@/portal/time-zone/time-zone.controller';
import { TimeZoneService } from '@/portal/time-zone/time-zone.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { SessionsModule } from '../sessions/sessions.module';
import { MediaModule } from '@/media/media.module';
import { UsersModule } from '../users/users.module';
import { PortalBundle } from '@/portal/catalog/entities/portal-bundle.entity';
import { PortalCampaignProgress } from '@/portal/campaigns/entities/portal-campaign-progress.entity';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalEmailOtpChallenge } from '@/portal/auth/entities/portal-email-otp-challenge.entity';
import { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalFaq } from '@/portal/catalog/entities/portal-faq.entity';
import { PortalFollow } from '@/portal/customer/entities/portal-follow.entity';
import { PortalOrderItem } from '@/portal/commerce/entities/portal-order-item.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { PortalReview } from '@/portal/reviews/entities/portal-review.entity';
import { PortalSavedOffer } from '@/portal/customer/entities/portal-saved-offer.entity';
import { PortalGift } from '@/portal/gifts/entities/portal-gift.entity';
import { PortalWallet } from '@/portal/commerce/entities/portal-wallet.entity';
import { PortalWalletTransaction } from '@/portal/commerce/entities/portal-wallet-transaction.entity';
import { PortalPromoCode } from '@/portal/commerce/entities/portal-promo-code.entity';
import { PortalBookingSlot } from '@/portal/bookings/entities/portal-booking-slot.entity';
import { PortalBooking } from '@/portal/bookings/entities/portal-booking.entity';
import { PortalAuthController } from '@/portal/auth/portal-auth.controller';
import { PortalAuthService } from '@/portal/auth/portal-auth.service';
import { PortalController } from './portal.controller';
import { PortalAvatarImport } from '@/portal/customer/entities/portal-avatar-import.entity';
import { PortalAvatarImportService } from '@/portal/customer/portal-avatar-import.service';
import { PortalAvatarService } from '@/portal/customer/portal-avatar.service';
import { PortalService } from './portal.service';
import { PassQrService } from '@/portal/passes/pass-qr.service';
import { PortalAdminController } from './admin/portal-admin.controller';
import { PortalAdminRecordsController } from './admin/portal-admin-records.controller';
import { PortalAdminCatalogController } from './admin/portal-admin-catalog.controller';
import {
  PortalBroadcastAdminService,
  PortalCityAdminService,
  PortalContentAdminService,
  PortalCouponCategoryAdminService,
} from './admin/portal-admin-catalog.service';
import { PortalBroadcast } from '@/portal/customer/entities/portal-broadcast.entity';
import { PortalCity } from '@/portal/catalog/entities/portal-city.entity';
import { PortalContentEntry } from '@/portal/catalog/entities/portal-content-entry.entity';
import { PortalCouponCategory } from '@/portal/catalog/entities/portal-coupon-category.entity';
import {
  PortalCampaignLedgerAdminService,
  PortalCommerceOutboxAdminService,
  PortalCustomerAdminService,
  PortalGiftAdminService,
  PortalReferralAdminService,
  PortalSavedOfferAdminService,
  PortalWalletAdminService,
  PortalWalletTransactionAdminService,
} from './admin/portal-admin-records.service';
import {
  PortalAdminDashboardService,
  PortalBundleAdminService,
  PortalCampaignAdminService,
  PortalCampaignProgressAdminService,
  PortalCouponAdminService,
  PortalEventAdminService,
  PortalEventTicketAdminService,
  PortalFaqAdminService,
  PortalFollowAdminService,
  PortalOrderAdminService,
  PortalOrderItemAdminService,
  PortalOtpAdminService,
  PortalTicketAdminService,
  PortalVoucherAdminService,
  PortalReviewAdminService,
  PortalPromoCodeAdminService,
  PortalBookingSlotAdminService,
  PortalBookingAdminService,
} from './admin/portal-admin.service';

@Module({
  imports: [
    AuthModule,
    MailModule,
    NotificationsModule,
    SessionsModule,
    UsersModule,
    MediaModule,
    TypeOrmModule.forFeature([
      PortalAvatarImport,
      PortalCommerceOutbox,
      PortalBroadcast,
      PortalCity,
      PortalContentEntry,
      PortalCouponCategory,
      PortalBundle,
      PortalCampaign,
      PortalCampaignLedger,
      PortalReferral,
      PortalCampaignProgress,
      PortalCoupon,
      PortalCouponPackage,
      PortalEmailOtpChallenge,
      PortalEvent,
      PortalEventTicket,
      PortalFaq,
      PortalFollow,
      PortalOrder,
      PortalOrderItem,
      PortalTicket,
      PortalVoucher,
      PortalReview,
      PortalSavedOffer,
      PortalGift,
      PortalWallet,
      PortalWalletTransaction,
      PortalPromoCode,
      PortalBookingSlot,
      PortalBooking,
      Role,
      User,
    ]),
  ],
  controllers: [
    TimeZoneController,
    PortalAuthController,
    PortalController,
    PortalAdminController,
    PortalAdminRecordsController,
    PortalAdminCatalogController,
  ],
  providers: [
    PortalCatalogService,
    PortalReviewsService,
    PortalCustomerService,
    PortalGiftsService,
    PortalBookingsService,
    PortalPassesService,
    PortalCommerceService,
    PortalCampaignCatalogService,
    TimeZoneService,
    PortalAuthService,
    PortalService,
    PassQrService,
    PortalCampaignService,
    PortalCampaignReconciliationService,
    PortalPaymentExpiryService,
    PortalAvatarService,
    PortalAvatarImportService,
    PortalAdminDashboardService,
    PortalBundleAdminService,
    PortalCampaignAdminService,
    PortalCampaignProgressAdminService,
    PortalCouponAdminService,
    PortalEventAdminService,
    PortalEventTicketAdminService,
    PortalFaqAdminService,
    PortalFollowAdminService,
    PortalOrderAdminService,
    PortalOrderItemAdminService,
    PortalOtpAdminService,
    PortalTicketAdminService,
    PortalVoucherAdminService,
    PortalReviewAdminService,
    PortalPromoCodeAdminService,
    PortalBookingSlotAdminService,
    PortalBookingAdminService,
    PortalGiftAdminService,
    PortalReferralAdminService,
    PortalWalletAdminService,
    PortalWalletTransactionAdminService,
    PortalSavedOfferAdminService,
    PortalCampaignLedgerAdminService,
    PortalCommerceOutboxAdminService,
    PortalCustomerAdminService,
    PortalCouponCategoryAdminService,
    PortalCityAdminService,
    PortalContentAdminService,
    PortalBroadcastAdminService,
  ],
})
export class PortalModule {}
