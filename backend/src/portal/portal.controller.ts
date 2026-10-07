import { ClearCacheOnWrite } from '../common/cache/clear-cache-on-write.interceptor';
import { OrderQueryDto } from '@/portal/commerce/dto/order-query.dto';
import {
  PortalOrderResponseDto,
  PortalOrdersResponseDto,
} from '@/portal/commerce/dto/order-response.dto';
import {
  PurchaseLimitQueryDto,
  PurchaseLimitResponseDto,
} from '@/portal/catalog/dto/purchase-limit.dto';
import { CacheService } from '@/common/cache/cache.service';
import { ApiHeader, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { CookieCsrfGuard } from '@/auth/cookie-csrf.guard';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import {
  CampaignListResponseDto,
  CampaignResponseDto,
  ReferralResponseDto,
  ConfirmReferralResponseDto,
  CampaignHistoryResponseDto,
  MyCampaignListResponseDto,
  CampaignProgressResponseDto,
} from '@/portal/campaigns/dto/campaign-response.dto';
import { PortalCampaignService } from '@/portal/campaigns/portal-campaign.service';
import { ConfirmReferralDto } from '@/portal/campaigns/dto/campaign-activity.dto';
import { ClaimCouponDto } from '@/portal/catalog/dto/coupon-package.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { IAuthRequest } from '../auth/interfaces/auth-request.interface';
import { CampaignQueryDto } from '@/portal/campaigns/dto/campaign-query.dto';
import { CatalogQueryDto } from '@/portal/catalog/dto/catalog-query.dto';
import { CreatePortalFollowDto } from '@/portal/customer/dto/follow.dto';
import {
  CreatePortalOrderDto,
  RequestPortalRefundDto,
} from '@/portal/commerce/dto/order.dto';
import {
  UpdatePortalProfileDto,
  PortalProfileResponseDto,
} from '@/portal/customer/dto/profile.dto';
import {
  CreatePortalReviewDto,
  ReviewQueryDto,
} from '@/portal/reviews/dto/review.dto';
import { CreatePortalGiftDto } from '@/portal/gifts/dto/gift.dto';
import { NotificationPageQueryDto } from '@/portal/customer/dto/notification-query.dto';
import { CreatePortalBookingDto } from '@/portal/bookings/dto/booking.dto';
import {
  PaymentMethodsResponseDto,
  PayPortalOrderDto,
} from '@/portal/commerce/dto/payment.dto';
import { PortalPaymentWebhookDto } from '@/portal/commerce/dto/payment-webhook.dto';
import {
  CreatePortalSavedOfferDto,
  SavedOfferQueryDto,
} from '@/portal/customer/dto/saved-offer.dto';
import { CouponCatalogQueryDto } from '@/portal/catalog/dto/coupon-catalog-query.dto';
import {
  CouponCategoryQueryDto,
  CouponCategoryResponseDto,
} from '@/portal/catalog/dto/coupon-category.dto';
import { PortalService } from './portal.service';
import { PortalContentResponseDto } from './admin/dto/admin-catalog.dto';
import { PassQrResponseDto } from '@/portal/passes/dto/pass-qr.dto';
import { PassQrService } from '@/portal/passes/pass-qr.service';
import {
  ThrottlePerUser,
  UserThrottlerGuard,
} from '@/common/guards/user-throttler.guard';

@ApiTags('KuponMalam Portal')
@ApiHeader({
  name: 'X-CSRF-Token',
  required: false,
  description:
    'Required on cookie-authenticated writes; must match the csrfToken cookie',
})
@Controller('portal')
@UseGuards(CookieCsrfGuard)
// Customer actions show up in the cached admin lists (orders, vouchers, reviews…).
@UseInterceptors(ClearCacheOnWrite('*/portal/admin*'))
export class PortalController {
  constructor(
    private readonly portalService: PortalService,
    private readonly campaigns: PortalCampaignService,
    private readonly passQr: PassQrService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('catalog/coupons')
  listCoupons(@Query() query: CouponCatalogQueryDto) {
    return this.portalService.listCoupons(query);
  }

  @Get('catalog/categories')
  @ApiOkResponse({ type: [CouponCategoryResponseDto] })
  listCouponCategories(@Query() query: CouponCategoryQueryDto) {
    return this.portalService.listCouponCategories(query);
  }

  @Get('catalog/coupons/:slug')
  getCoupon(@Param('slug') slug: string) {
    return this.portalService.getCoupon(slug);
  }

  @Get('reviews')
  listReviews(@Query() query: ReviewQueryDto) {
    return this.portalService.listReviews(query);
  }

  @Get('catalog/events')
  listEvents(@Query() query: CatalogQueryDto) {
    return this.portalService.listEvents(query);
  }

  @Get('catalog/events/:slug')
  getEvent(@Param('slug') slug: string) {
    return this.portalService.getEvent(slug);
  }

  @Get('catalog/events/:slug/slots')
  listBookingSlots(@Param('slug') slug: string) {
    return this.portalService.listBookingSlots(slug);
  }

  @Get('gifts/:code')
  getPublicGift(@Param('code') code: string) {
    return this.portalService.getPublicGift(code);
  }

  @Get('bundles')
  listBundles() {
    return this.portalService.listBundles();
  }

  @Get('bundles/:slug')
  getBundle(@Param('slug') slug: string) {
    return this.portalService.getBundle(slug);
  }

  @Get('campaigns')
  @ApiOkResponse({ type: CampaignListResponseDto })
  listCampaigns(@Query() query: CampaignQueryDto) {
    return this.portalService.listCampaigns(query);
  }

  @Get('campaigns/:slug')
  @ApiOkResponse({ type: CampaignResponseDto })
  getCampaign(@Param('slug') slug: string) {
    return this.portalService.getCampaign(slug);
  }

  @ApiServiceUnavailableResponse({
    description: 'Transient transaction failure; retry after recovery',
  })
  @Get('me/referral')
  @ApiOkResponse({ type: ReferralResponseDto })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getReferral(@Req() req: IAuthRequest) {
    return this.campaigns.getReferral(req.user.userId);
  }

  @ApiServiceUnavailableResponse({
    description:
      'Transient transaction failure; retry the same operation and original idempotency key',
  })
  @Post('me/referral')
  @ApiCreatedResponse({ type: ConfirmReferralResponseDto })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  confirmReferral(@Req() req: IAuthRequest, @Body() dto: ConfirmReferralDto) {
    return this.campaigns.confirmReferral(req.user.userId, dto.code);
  }

  @Get('me/campaigns')
  @ApiOkResponse({ type: MyCampaignListResponseDto })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  myCampaigns(@Req() req: IAuthRequest, @Query() query: CampaignQueryDto) {
    return this.campaigns.mine(req.user.userId, query.page, query.limit);
  }

  @Get('me/campaigns/:slug/history')
  @ApiOkResponse({ type: CampaignHistoryResponseDto })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  campaignHistory(
    @Req() req: IAuthRequest,
    @Param('slug') slug: string,
    @Query() query: CampaignQueryDto,
  ) {
    return this.campaigns.history(
      req.user.userId,
      slug,
      query.page,
      query.limit,
    );
  }

  @Get('locations')
  listLocations() {
    return this.portalService.listLocations();
  }

  @Get('support/faq')
  listFaq() {
    return this.portalService.listFaq();
  }

  @Get('content/:key')
  @ApiOkResponse({ type: PortalContentResponseDto })
  @ApiNotFoundResponse({ description: 'Unknown or unpublished content key' })
  getContent(@Param('key') key: string) {
    return this.portalService.getContent(key);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('auth/me')
  getAuthMe(@Req() req: IAuthRequest) {
    return req.user;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: PortalProfileResponseDto })
  @Get('me/profile')
  getProfile(@Req() req: IAuthRequest) {
    return this.portalService.getProfile(req.user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 201, type: PortalProfileResponseDto })
  @Post('me/profile/avatar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('avatar', { limits: { fileSize: 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: { avatar: { type: 'string', format: 'binary' } },
    },
  })
  uploadAvatar(
    @Req() req: IAuthRequest,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /^image\/jpeg$/,
            overrideMimeType: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.portalService.uploadAvatar(req.user.userId, file);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: PortalProfileResponseDto })
  @Patch('me/profile')
  updateProfile(@Req() req: IAuthRequest, @Body() dto: UpdatePortalProfileDto) {
    return this.portalService.updateProfile(req.user.userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/reviews')
  listMyReviews(@Req() req: IAuthRequest) {
    return this.portalService.listReviews({ userId: req.user.userId });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/reviews')
  createReview(@Req() req: IAuthRequest, @Body() dto: CreatePortalReviewDto) {
    return this.portalService.createReview(req.user.userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/gifts')
  listGifts(@Req() req: IAuthRequest) {
    return this.portalService.listGifts(req.user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @ThrottlePerUser(5, 60_000)
  @Post('me/gifts')
  createGift(@Req() req: IAuthRequest, @Body() dto: CreatePortalGiftDto) {
    return this.portalService.createGift(req.user.userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @ThrottlePerUser(10, 60_000)
  @Post('gifts/:code/redeem')
  redeemGift(@Req() req: IAuthRequest, @Param('code') code: string) {
    return this.portalService.redeemGift(req.user.userId, code);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/rewards')
  getRewards(@Req() req: IAuthRequest) {
    return this.portalService.getRewards(req.user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/saved-offers')
  listSavedOffers(
    @Req() req: IAuthRequest,
    @Query() query: SavedOfferQueryDto,
  ) {
    return this.portalService.listSavedOffers(req.user.userId, query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/saved-offers')
  saveOffer(@Req() req: IAuthRequest, @Body() dto: CreatePortalSavedOfferDto) {
    return this.portalService.saveOffer(req.user.userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('me/saved-offers/:id')
  unsaveOffer(@Req() req: IAuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.portalService.unsaveOffer(req.user.userId, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('coupons/:slug/claim')
  claimCoupon(
    @Req() req: IAuthRequest,
    @Param('slug') slug: string,
    @Body() dto: ClaimCouponDto,
  ) {
    return this.portalService.claimCoupon(
      req.user.userId,
      slug,
      dto.packagePublicId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/vouchers')
  listVouchers(@Req() req: IAuthRequest) {
    return this.portalService.listVouchers(req.user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/vouchers/:id')
  getVoucher(@Req() req: IAuthRequest, @Param('id') id: string) {
    return this.portalService.getVoucher(req.user.userId, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @ThrottlePerUser(30, 60_000)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PassQrResponseDto })
  @ApiConflictResponse({
    description: 'Pass is not usable (not Issued or expired)',
  })
  @Get('me/vouchers/:id/qr')
  getVoucherQr(@Req() req: IAuthRequest, @Param('id') id: string) {
    return this.passQr.issue('voucher', req.user.userId, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/tickets')
  listTickets(@Req() req: IAuthRequest) {
    return this.portalService.listTickets(req.user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/tickets/:code')
  getTicket(@Req() req: IAuthRequest, @Param('code') code: string) {
    return this.portalService.getTicket(req.user.userId, code);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, UserThrottlerGuard)
  @ThrottlePerUser(30, 60_000)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: PassQrResponseDto })
  @ApiConflictResponse({
    description: 'Pass is not usable (not Issued or expired)',
  })
  @Get('me/tickets/:code/qr')
  getTicketQr(@Req() req: IAuthRequest, @Param('code') code: string) {
    return this.passQr.issue('ticket', req.user.userId, code);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiServiceUnavailableResponse({
    description:
      'Transient transaction failure; retry the same operation and original idempotency key',
  })
  @ApiCreatedResponse({ type: PortalOrderResponseDto })
  @Post('orders')
  createOrder(
    @Req() req: IAuthRequest,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreatePortalOrderDto,
  ) {
    return this.mutate(
      this.portalService.createOrder(req.user.userId, dto, idempotencyKey),
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiServiceUnavailableResponse({
    description:
      'Transient transaction failure; retry the same operation and original idempotency key',
  })
  @ApiCreatedResponse({ type: PortalOrderResponseDto })
  @Post('me/orders/:id/pay')
  payOrder(
    @Req() req: IAuthRequest,
    @Param('id') id: string,
    @Body() dto: PayPortalOrderDto,
  ) {
    return this.mutate(this.portalService.payOrder(req.user.userId, id, dto));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiServiceUnavailableResponse({
    description:
      'Transient transaction failure; retry the same operation and original idempotency key',
  })
  @ApiCreatedResponse({ type: PortalOrderResponseDto })
  @Post('me/orders/:id/cancel')
  cancelOrder(@Req() req: IAuthRequest, @Param('id') id: string) {
    return this.mutate(this.portalService.cancelOrder(req.user.userId, id));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiServiceUnavailableResponse({
    description:
      'Transient transaction failure; retry the same operation and original idempotency key',
  })
  @ApiCreatedResponse({ type: PortalOrderResponseDto })
  @Post('me/orders/:id/refund-request')
  requestRefund(
    @Req() req: IAuthRequest,
    @Param('id') id: string,
    @Body() dto: RequestPortalRefundDto,
  ) {
    return this.mutate(
      this.portalService.requestRefund(req.user.userId, id, dto.reason),
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ type: PortalOrderResponseDto })
  @Post('me/orders/:id/sandbox-confirm')
  simulatePayment(@Req() req: IAuthRequest, @Param('id') id: string) {
    return this.mutate(this.portalService.simulatePayment(req.user.userId, id));
  }

  @Get('payments/methods')
  @ApiOkResponse({ type: PaymentMethodsResponseDto })
  paymentMethods(): PaymentMethodsResponseDto {
    return this.portalService.paymentMethods();
  }

  @ApiCreatedResponse({ type: PortalOrderResponseDto })
  @Post('payments/webhook')
  handlePaymentWebhook(
    @Headers('x-portal-webhook-secret') secret: string,
    @Body() dto: PortalPaymentWebhookDto,
  ) {
    return this.mutate(this.portalService.handlePaymentWebhook(secret, dto));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: PurchaseLimitResponseDto })
  @Get('me/purchase-limit')
  purchaseLimit(
    @Req() req: IAuthRequest,
    @Query() query: PurchaseLimitQueryDto,
  ) {
    return this.portalService.getPurchaseLimit(
      req.user.userId,
      query.kind,
      query.slug,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: PortalOrdersResponseDto })
  @Get('me/orders')
  listOrders(@Req() req: IAuthRequest, @Query() query: OrderQueryDto) {
    return this.portalService.listOrders(req.user.userId, query);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: PortalOrderResponseDto })
  @Get('me/orders/:id')
  getOrder(@Req() req: IAuthRequest, @Param('id') id: string) {
    return this.portalService.getOrder(req.user.userId, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/bookings')
  listBookings(@Req() req: IAuthRequest) {
    return this.portalService.listBookings(req.user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/bookings')
  createBooking(@Req() req: IAuthRequest, @Body() dto: CreatePortalBookingDto) {
    return this.portalService.createBooking(req.user.userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/bookings/:id/cancel')
  cancelBooking(
    @Req() req: IAuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.portalService.cancelBooking(req.user.userId, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/following')
  listFollowing(@Req() req: IAuthRequest) {
    return this.portalService.listFollowing(req.user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/following')
  addFollowing(@Req() req: IAuthRequest, @Body() dto: CreatePortalFollowDto) {
    return this.portalService.addFollowing(req.user.userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('me/following/:id')
  removeFollowing(
    @Req() req: IAuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.portalService.removeFollowing(req.user.userId, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/notifications')
  listNotifications(
    @Req() req: IAuthRequest,
    @Query() query: NotificationPageQueryDto,
  ) {
    return this.portalService.listNotifications(
      req.user,
      query.page,
      query.limit,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me/notifications/:id/read')
  markNotificationRead(
    @Req() req: IAuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.portalService.markNotificationRead(req.user, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/notifications/read-all')
  @ApiResponse({
    status: 201,
    schema: {
      type: 'object',
      required: ['message'],
      properties: { message: { type: 'string' } },
    },
  })
  markAllNotificationsRead(@Req() req: IAuthRequest) {
    return this.portalService.markAllNotificationsRead(req.user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/campaigns/:slug/progress')
  @ApiOkResponse({ type: CampaignProgressResponseDto })
  getProgress(@Req() req: IAuthRequest, @Param('slug') slug: string) {
    return this.portalService.getProgress(req.user.userId, slug);
  }

  private async mutate<T>(operation: Promise<T>) {
    const result = await operation;
    await this.cacheService.clearKeys('*/portal*');
    return result;
  }
}
