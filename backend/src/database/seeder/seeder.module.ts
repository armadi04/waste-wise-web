import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeederService } from './seeder.service';
import { Permission } from '../../permissions/entities/permission.entity';
import { Role } from '../../roles/entities/role.entity';
import { User } from '../../users/entities/user.entity';
import { ConfigModule } from '@nestjs/config';
import { Notification } from '../../notifications/entities/notification.entity';
import { PortalBundle } from '@/portal/catalog/entities/portal-bundle.entity';
import { PortalCampaignProgress } from '@/portal/campaigns/entities/portal-campaign-progress.entity';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
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
import { PortalSeedService } from '@/portal/seed/portal-seed.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Permission,
      Role,
      User,
      Notification,
      PortalBundle,
      PortalCampaign,
      PortalCampaignProgress,
      PortalCoupon,
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
    ]),
  ],
  providers: [SeederService, PortalSeedService],
  exports: [SeederService],
})
export class SeederModule {}
