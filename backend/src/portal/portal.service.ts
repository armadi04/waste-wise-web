import { OrderQueryDto } from '@/portal/commerce/dto/order-query.dto';
import { CatalogQueryDto } from '@/portal/catalog/dto/catalog-query.dto';
import { CouponCatalogQueryDto } from '@/portal/catalog/dto/coupon-catalog-query.dto';
import { CouponCategoryQueryDto } from '@/portal/catalog/dto/coupon-category.dto';
import { CreatePortalFollowDto } from '@/portal/customer/dto/follow.dto';
import { CreatePortalOrderDto } from '@/portal/commerce/dto/order.dto';
import { UpdatePortalProfileDto } from '@/portal/customer/dto/profile.dto';
import {
  CreatePortalReviewDto,
  ReviewQueryDto,
} from '@/portal/reviews/dto/review.dto';
import {
  CreatePortalSavedOfferDto,
  SavedOfferQueryDto,
} from '@/portal/customer/dto/saved-offer.dto';
import { CreatePortalGiftDto } from '@/portal/gifts/dto/gift.dto';
import { PayPortalOrderDto } from '@/portal/commerce/dto/payment.dto';
import { PortalPaymentWebhookDto } from '@/portal/commerce/dto/payment-webhook.dto';
import { CreatePortalBookingDto } from '@/portal/bookings/dto/booking.dto';
import { CampaignQueryDto } from '@/portal/campaigns/dto/campaign-query.dto';
import type { AuthenticatedUser } from '@/auth/interfaces/auth-request.interface';
import { Injectable } from '@nestjs/common';
import { PortalCatalogService } from '@/portal/catalog/portal-catalog.service';
import { PortalReviewsService } from '@/portal/reviews/portal-reviews.service';
import { PortalCustomerService } from '@/portal/customer/portal-customer.service';
import { PortalGiftsService } from '@/portal/gifts/portal-gifts.service';
import { PortalBookingsService } from '@/portal/bookings/portal-bookings.service';
import { PortalPassesService } from '@/portal/passes/portal-passes.service';
import { PortalCommerceService } from '@/portal/commerce/portal-commerce.service';
import { PortalCampaignCatalogService } from '@/portal/campaigns/portal-campaign-catalog.service';
@Injectable()
export class PortalService {
  constructor(
    private readonly catalog: PortalCatalogService,
    private readonly reviews: PortalReviewsService,
    private readonly customer: PortalCustomerService,
    private readonly gifts: PortalGiftsService,
    private readonly bookings: PortalBookingsService,
    private readonly passes: PortalPassesService,
    private readonly commerce: PortalCommerceService,
    private readonly campaigns: PortalCampaignCatalogService,
  ) {}
  async listCoupons(query: CouponCatalogQueryDto) {
    return this.catalog.listCoupons(query);
  }

  async getCoupon(slug: string) {
    return this.catalog.getCoupon(slug);
  }

  async listEvents(query: CatalogQueryDto) {
    return this.catalog.listEvents(query);
  }

  async getEvent(slug: string) {
    return this.catalog.getEvent(slug);
  }

  async listBundles() {
    return this.catalog.listBundles();
  }

  async getBundle(slug: string) {
    return this.catalog.getBundle(slug);
  }

  async listFaq() {
    return this.catalog.listFaq();
  }

  async listCouponCategories(query: CouponCategoryQueryDto) {
    return this.catalog.listCouponCategories(query);
  }

  async getContent(key: string) {
    return this.catalog.getContent(key);
  }

  async listLocations() {
    return this.catalog.listLocations();
  }

  async listReviews(query: ReviewQueryDto & { userId?: number }) {
    return this.reviews.listReviews(query);
  }

  async createReview(userId: number, dto: CreatePortalReviewDto) {
    return this.reviews.createReview(userId, dto);
  }

  async listSavedOffers(userId: number, query: SavedOfferQueryDto) {
    return this.customer.listSavedOffers(userId, query);
  }

  async saveOffer(userId: number, dto: CreatePortalSavedOfferDto) {
    return this.customer.saveOffer(userId, dto);
  }

  async unsaveOffer(userId: number, id: number) {
    return this.customer.unsaveOffer(userId, id);
  }

  async getRewards(userId: number) {
    return this.customer.getRewards(userId);
  }

  async getProfile(userId: number) {
    return this.customer.getProfile(userId);
  }

  async updateProfile(userId: number, dto: UpdatePortalProfileDto) {
    return this.customer.updateProfile(userId, dto);
  }

  async uploadAvatar(userId: number, file: Express.Multer.File) {
    return this.customer.uploadAvatar(userId, file);
  }

  async listFollowing(userId: number) {
    return this.customer.listFollowing(userId);
  }

  async addFollowing(userId: number, dto: CreatePortalFollowDto) {
    return this.customer.addFollowing(userId, dto);
  }

  async removeFollowing(userId: number, id: number) {
    return this.customer.removeFollowing(userId, id);
  }

  async listNotifications(user: AuthenticatedUser, page = 1, limit = 20) {
    return this.customer.listNotifications(user, page, limit);
  }

  async markNotificationRead(user: AuthenticatedUser, id: number) {
    return this.customer.markNotificationRead(user, id);
  }

  async markAllNotificationsRead(user: AuthenticatedUser) {
    return this.customer.markAllNotificationsRead(user);
  }

  async getProgress(userId: number, slug: string) {
    return this.customer.getProgress(userId, slug);
  }

  async listGifts(userId: number) {
    return this.gifts.listGifts(userId);
  }

  async createGift(userId: number, dto: CreatePortalGiftDto) {
    return this.gifts.createGift(userId, dto);
  }

  async getPublicGift(code: string) {
    return this.gifts.getPublicGift(code);
  }

  async redeemGift(userId: number, code: string) {
    return this.gifts.redeemGift(userId, code);
  }

  async listBookingSlots(slug: string) {
    return this.bookings.listBookingSlots(slug);
  }

  async createBooking(userId: number, dto: CreatePortalBookingDto) {
    return this.bookings.createBooking(userId, dto);
  }

  async cancelBooking(userId: number, id: number) {
    return this.bookings.cancelBooking(userId, id);
  }

  async listBookings(userId: number) {
    return this.bookings.listBookings(userId);
  }

  async claimCoupon(userId: number, slug: string, packagePublicId?: string) {
    return this.passes.claimCoupon(userId, slug, packagePublicId);
  }

  async listVouchers(userId: number) {
    return this.passes.listVouchers(userId);
  }

  async getVoucher(userId: number, codeOrId: string) {
    return this.passes.getVoucher(userId, codeOrId);
  }

  async listTickets(userId: number) {
    return this.passes.listTickets(userId);
  }

  async getTicket(userId: number, code: string) {
    return this.passes.getTicket(userId, code);
  }

  async getPurchaseLimit(
    userId: number,
    kind: 'coupon' | 'ticket' | 'bundle',
    slug: string,
  ) {
    return this.commerce.getPurchaseLimit(userId, kind, slug);
  }

  async createOrder(
    userId: number,
    dto: CreatePortalOrderDto,
    idempotencyKey: string,
  ) {
    return this.commerce.createOrder(userId, dto, idempotencyKey);
  }

  async payOrder(
    userId: number,
    idOrNumber: string,
    dto: PayPortalOrderDto,
    confirmation?: { source: 'sandbox' | 'webhook'; reference?: string },
  ) {
    return this.commerce.payOrder(userId, idOrNumber, dto, confirmation);
  }

  async simulatePayment(userId: number, idOrNumber: string) {
    return this.commerce.simulatePayment(userId, idOrNumber);
  }

  async expirePendingOrders() {
    return this.commerce.expirePendingOrders();
  }

  async cancelOrder(userId: number, idOrNumber: string) {
    return this.commerce.cancelOrder(userId, idOrNumber);
  }

  async requestRefund(userId: number, idOrNumber: string, reason: string) {
    return this.commerce.requestRefund(userId, idOrNumber, reason);
  }

  async handlePaymentWebhook(
    secret: string | undefined,
    dto: PortalPaymentWebhookDto,
  ) {
    return this.commerce.handlePaymentWebhook(secret, dto);
  }

  async approveRefund(id: number, actorId: number) {
    return this.commerce.approveRefund(id, actorId);
  }

  async rejectRefund(id: number, actorId: number, reason: string) {
    return this.commerce.rejectRefund(id, actorId, reason);
  }

  async deliverCommerceEvents() {
    return this.commerce.deliverCommerceEvents();
  }

  async listOrders(userId: number, query: OrderQueryDto = new OrderQueryDto()) {
    return this.commerce.listOrders(userId, query);
  }

  async getOrder(userId: number, idOrNumber: string) {
    return this.commerce.getOrder(userId, idOrNumber);
  }

  paymentMethods(): { methods: Array<'va' | 'coins'> } {
    return this.commerce.paymentMethods();
  }

  async listCampaigns(query: CampaignQueryDto) {
    return this.campaigns.listCampaigns(query);
  }

  async getCampaign(slug: string) {
    return this.campaigns.getCampaign(slug);
  }
}
