import { RequestPortalRefundDto } from '@/portal/commerce/dto/order.dto';
import { PortalService } from '../portal.service';
import { PortalOrderResponseDto } from '@/portal/commerce/dto/order-response.dto';
import { ApiHeader, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { CookieCsrfGuard } from '@/auth/cookie-csrf.guard';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import {
  VerifyCampaignUsageResponseDto,
  CampaignAdjustmentResponseDto,
} from '@/portal/campaigns/dto/campaign-response.dto';
import { PortalCampaignService } from '@/portal/campaigns/portal-campaign.service';
import { PassQrService } from '@/portal/passes/pass-qr.service';
import { ScanPassDto } from '@/portal/passes/dto/pass-qr.dto';
import { CampaignAdjustmentDto } from '@/portal/campaigns/dto/campaign-activity.dto';
import type { IAuthRequest } from '@/auth/interfaces/auth-request.interface';
import {
  Req,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '@/auth/permissions.decorator';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { BulkDeleteDto } from '@/common/dto/bulk-delete.dto';
import { PaginationParamsDto } from '@/common/dto/pagination-params.dto';
import { CacheService } from '@/common/cache/cache.service';
import {
  CreatePortalBundleDto,
  CreatePortalCampaignDto,
  CreatePortalCouponDto,
  CreatePortalEmailOtpChallengeDto,
  CreatePortalEventDto,
  CreatePortalEventTicketDto,
  CreatePortalFaqDto,
  CreatePortalFollowDto,
  CreatePortalOrderDto,
  CreatePortalOrderItemDto,
  CreatePortalTicketDto,
  CreatePortalVoucherDto,
  UpdatePortalBundleDto,
  UpdatePortalCampaignDto,
  UpdatePortalCouponDto,
  UpdatePortalEmailOtpChallengeDto,
  CreatePortalPromoCodeDto,
  UpdatePortalPromoCodeDto,
  CreatePortalBookingSlotDto,
  UpdatePortalBookingSlotDto,
  UpdatePortalReviewDto,
  UpdatePortalBookingDto,
  UpdatePortalEventDto,
  UpdatePortalEventTicketDto,
  UpdatePortalFaqDto,
  UpdatePortalFollowDto,
  UpdatePortalOrderDto,
  UpdatePortalOrderItemDto,
  UpdatePortalTicketDto,
  UpdatePortalVoucherDto,
} from './dto/admin.dto';
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
  PortalReviewAdminService,
  PortalPromoCodeAdminService,
  PortalBookingSlotAdminService,
  PortalBookingAdminService,
  PortalTicketAdminService,
  PortalVoucherAdminService,
} from './portal-admin.service';
import { BaseService } from '@/common/services/base.service';
import { FindOptionsWhere, ObjectLiteral } from 'typeorm';
import { PortalAdminRecordQueryDto } from './dto/admin-records.dto';

@ApiTags('Portal Admin')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-CSRF-Token',
  required: false,
  description:
    'Required on cookie-authenticated writes; must match the csrfToken cookie',
})
@Controller('portal/admin')
@UseGuards(JwtAuthGuard, CookieCsrfGuard, PermissionsGuard)
export class PortalAdminController {
  constructor(
    private readonly dashboard: PortalAdminDashboardService,
    private readonly coupons: PortalCouponAdminService,
    private readonly events: PortalEventAdminService,
    private readonly eventTickets: PortalEventTicketAdminService,
    private readonly bundles: PortalBundleAdminService,
    private readonly campaigns: PortalCampaignAdminService,
    private readonly faqs: PortalFaqAdminService,
    private readonly vouchers: PortalVoucherAdminService,
    private readonly tickets: PortalTicketAdminService,
    private readonly orders: PortalOrderAdminService,
    private readonly orderItems: PortalOrderItemAdminService,
    private readonly follows: PortalFollowAdminService,
    private readonly campaignProgress: PortalCampaignProgressAdminService,
    private readonly otpChallenges: PortalOtpAdminService,
    private readonly reviews: PortalReviewAdminService,
    private readonly promoCodes: PortalPromoCodeAdminService,
    private readonly bookingSlots: PortalBookingSlotAdminService,
    private readonly bookings: PortalBookingAdminService,
    private readonly cacheService: CacheService,
    private readonly campaignEngine: PortalCampaignService,
    private readonly passQr: PassQrService,
    private readonly portal: PortalService,
  ) {}

  @ApiServiceUnavailableResponse({
    description:
      'Transient transaction failure; retry the same operation and original idempotency key',
  })
  @Post('orders/:id/refund-approve')
  @ApiCreatedResponse({ type: PortalOrderResponseDto })
  @Permissions('portal.orders.refund')
  async approveRefund(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: IAuthRequest,
  ) {
    return this.mutate(this.portal.approveRefund(id, req.user.userId));
  }

  @Post('orders/:id/refund-reject')
  @Permissions('portal.orders.refund')
  @ApiCreatedResponse({ type: PortalOrderResponseDto })
  async rejectRefund(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: IAuthRequest,
    @Body() dto: RequestPortalRefundDto,
  ) {
    return this.mutate(
      this.portal.rejectRefund(id, req.user.userId, dto.reason),
    );
  }

  @Post('vouchers/:id/redeem')
  @ApiCreatedResponse({ type: VerifyCampaignUsageResponseDto })
  @Permissions('portal.vouchers.redeem')
  async redeemVoucher(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: IAuthRequest,
  ) {
    return this.mutate(
      this.campaignEngine.verifyUsage('voucher', id, req.user.userId),
    );
  }

  @ApiServiceUnavailableResponse({
    description:
      'Transient transaction failure; retry the same operation and original idempotency key',
  })
  @Post('tickets/:id/check-in')
  @ApiCreatedResponse({ type: VerifyCampaignUsageResponseDto })
  @Permissions('portal.tickets.check_in')
  async checkInTicket(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: IAuthRequest,
  ) {
    return this.mutate(
      this.campaignEngine.verifyUsage('ticket', id, req.user.userId),
    );
  }

  @ApiServiceUnavailableResponse({
    description:
      'Transient transaction failure; retry the same operation and original idempotency key',
  })
  @Post('vouchers/scan')
  @ApiCreatedResponse({ type: VerifyCampaignUsageResponseDto })
  @ApiBadRequestResponse({
    description: 'Malformed, forged or wrong-kind pass token',
  })
  @ApiGoneResponse({
    description: 'Pass token expired; customer must refresh the QR',
  })
  @ApiNotFoundResponse({ description: 'Pass no longer exists' })
  @Permissions('portal.vouchers.redeem')
  async scanVoucher(@Body() dto: ScanPassDto, @Req() req: IAuthRequest) {
    const id = await this.passQr.resolve('voucher', dto.token);
    return this.mutate(
      this.campaignEngine.verifyUsage('voucher', id, req.user.userId),
    );
  }

  @ApiServiceUnavailableResponse({
    description:
      'Transient transaction failure; retry the same operation and original idempotency key',
  })
  @Post('tickets/scan')
  @ApiCreatedResponse({ type: VerifyCampaignUsageResponseDto })
  @ApiBadRequestResponse({
    description: 'Malformed, forged or wrong-kind pass token',
  })
  @ApiGoneResponse({
    description: 'Pass token expired; customer must refresh the QR',
  })
  @ApiNotFoundResponse({ description: 'Pass no longer exists' })
  @Permissions('portal.tickets.check_in')
  async scanTicket(@Body() dto: ScanPassDto, @Req() req: IAuthRequest) {
    const id = await this.passQr.resolve('ticket', dto.token);
    return this.mutate(
      this.campaignEngine.verifyUsage('ticket', id, req.user.userId),
    );
  }

  @ApiServiceUnavailableResponse({
    description:
      'Transient transaction failure; retry the same operation and original idempotency key',
  })
  @Post('campaign-progress/adjustments')
  @ApiCreatedResponse({ type: CampaignAdjustmentResponseDto })
  @Permissions('portal.campaign_progress.adjust')
  async adjustCampaignPoints(
    @Body() dto: CampaignAdjustmentDto,
    @Req() req: IAuthRequest,
  ) {
    return this.mutate(this.campaignEngine.adjust(dto, req.user.userId));
  }

  @Get('dashboard')
  @Permissions('portal.dashboard.read')
  getDashboard() {
    return this.dashboard.getOverview();
  }

  @Get('coupons')
  @Permissions('portal.coupons.read')
  @UseInterceptors(CacheInterceptor)
  listCoupons(@Query() params: PaginationParamsDto) {
    return this.list(this.coupons, params);
  }

  @Get('coupons/:id')
  @Permissions('portal.coupons.read')
  @UseInterceptors(CacheInterceptor)
  getCoupon(@Param('id', ParseIntPipe) id: number) {
    return this.coupons.findOne(id);
  }

  @Post('coupons')
  @Permissions('portal.coupons.create')
  async createCoupon(@Body() dto: CreatePortalCouponDto) {
    return this.mutate(this.coupons.create(dto));
  }

  @Patch('coupons/:id')
  @Permissions('portal.coupons.update')
  async updateCoupon(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalCouponDto,
    @Req() req: IAuthRequest,
  ) {
    return this.mutate(this.coupons.update(id, dto, req.user.userId));
  }

  @Delete('coupons/:id')
  @Permissions('portal.coupons.delete')
  async deleteCoupon(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.coupons.remove(id));
  }

  @Post('coupons/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.coupons.delete')
  async bulkDeleteCoupons(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.coupons.removeMany(dto.ids));
  }

  @Get('events')
  @Permissions('portal.events.read')
  @UseInterceptors(CacheInterceptor)
  listEvents(@Query() params: PaginationParamsDto) {
    return this.list(this.events, params);
  }

  @Get('events/:id')
  @Permissions('portal.events.read')
  @UseInterceptors(CacheInterceptor)
  getEvent(@Param('id', ParseIntPipe) id: number) {
    return this.events.findOne(id);
  }

  @Post('events')
  @Permissions('portal.events.create')
  async createEvent(@Body() dto: CreatePortalEventDto) {
    return this.mutate(this.events.create(dto));
  }

  @Patch('events/:id')
  @Permissions('portal.events.update')
  async updateEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalEventDto,
    @Req() req: IAuthRequest,
  ) {
    return this.mutate(this.events.update(id, dto, req.user.userId));
  }

  @Delete('events/:id')
  @Permissions('portal.events.delete')
  async deleteEvent(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.events.remove(id));
  }

  @Post('events/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.events.delete')
  async bulkDeleteEvents(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.events.removeMany(dto.ids));
  }

  @Get('events/:eventId/tickets')
  @Permissions('portal.event_tickets.read')
  @UseInterceptors(CacheInterceptor)
  listEventTickets(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.eventTickets.findByEvent(eventId);
  }

  @Post('events/:eventId/tickets')
  @Permissions('portal.event_tickets.create')
  async createNestedEventTicket(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: CreatePortalEventTicketDto,
  ) {
    return this.mutate(this.eventTickets.create({ ...dto, eventId }));
  }

  @Get('event-tickets')
  @Permissions('portal.event_tickets.read')
  @UseInterceptors(CacheInterceptor)
  listEventTicketsAll(@Query() params: PaginationParamsDto) {
    return this.list(this.eventTickets, params);
  }

  @Post('event-tickets')
  @Permissions('portal.event_tickets.create')
  async createEventTicket(@Body() dto: CreatePortalEventTicketDto) {
    return this.mutate(this.eventTickets.create(dto));
  }

  @Get('event-tickets/:id')
  @Permissions('portal.event_tickets.read')
  getEventTicket(@Param('id', ParseIntPipe) id: number) {
    return this.eventTickets.findOne(id);
  }

  @Patch('event-tickets/:id')
  @Permissions('portal.event_tickets.update')
  async updateEventTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalEventTicketDto,
  ) {
    return this.mutate(this.eventTickets.update(id, dto));
  }

  @Delete('event-tickets/:id')
  @Permissions('portal.event_tickets.delete')
  async deleteEventTicket(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.eventTickets.remove(id));
  }

  @Post('event-tickets/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.event_tickets.delete')
  async bulkDeleteEventTickets(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.eventTickets.removeMany(dto.ids));
  }

  @Get('bundles')
  @Permissions('portal.bundles.read')
  @UseInterceptors(CacheInterceptor)
  listBundles(@Query() params: PaginationParamsDto) {
    return this.list(this.bundles, params);
  }

  @Get('bundles/:id')
  @Permissions('portal.bundles.read')
  getBundle(@Param('id', ParseIntPipe) id: number) {
    return this.bundles.findOne(id);
  }

  @Post('bundles')
  @Permissions('portal.bundles.create')
  async createBundle(@Body() dto: CreatePortalBundleDto) {
    return this.mutate(this.bundles.create(dto));
  }

  @Patch('bundles/:id')
  @Permissions('portal.bundles.update')
  async updateBundle(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalBundleDto,
  ) {
    return this.mutate(this.bundles.update(id, dto));
  }

  @Delete('bundles/:id')
  @Permissions('portal.bundles.delete')
  async deleteBundle(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.bundles.remove(id));
  }

  @Post('bundles/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.bundles.delete')
  async bulkDeleteBundles(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.bundles.removeMany(dto.ids));
  }

  @Get('campaigns')
  @Permissions('portal.campaigns.read')
  @UseInterceptors(CacheInterceptor)
  listCampaigns(@Query() params: PaginationParamsDto) {
    return this.list(this.campaigns, params);
  }

  @Get('campaigns/:id')
  @Permissions('portal.campaigns.read')
  getCampaign(@Param('id', ParseIntPipe) id: number) {
    return this.campaigns.findOne(id);
  }

  @Post('campaigns')
  @Permissions('portal.campaigns.create')
  async createCampaign(@Body() dto: CreatePortalCampaignDto) {
    return this.mutate(this.campaigns.create(dto));
  }

  @Patch('campaigns/:id')
  @Permissions('portal.campaigns.update')
  async updateCampaign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalCampaignDto,
  ) {
    return this.mutate(this.campaigns.update(id, dto));
  }

  @Delete('campaigns/:id')
  @Permissions('portal.campaigns.delete')
  async deleteCampaign(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.campaigns.remove(id));
  }

  @Post('campaigns/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.campaigns.delete')
  async bulkDeleteCampaigns(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.campaigns.removeMany(dto.ids));
  }

  @Get('faqs')
  @Permissions('portal.faqs.read')
  @UseInterceptors(CacheInterceptor)
  listFaqs(@Query() params: PaginationParamsDto) {
    return this.list(this.faqs, params);
  }

  @Get('faqs/:id')
  @Permissions('portal.faqs.read')
  getFaq(@Param('id', ParseIntPipe) id: number) {
    return this.faqs.findOne(id);
  }

  @Post('faqs')
  @Permissions('portal.faqs.create')
  async createFaq(@Body() dto: CreatePortalFaqDto) {
    return this.mutate(this.faqs.create(dto));
  }

  @Patch('faqs/:id')
  @Permissions('portal.faqs.update')
  async updateFaq(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalFaqDto,
  ) {
    return this.mutate(this.faqs.update(id, dto));
  }

  @Delete('faqs/:id')
  @Permissions('portal.faqs.delete')
  async deleteFaq(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.faqs.remove(id));
  }

  @Post('faqs/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.faqs.delete')
  async bulkDeleteFaqs(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.faqs.removeMany(dto.ids));
  }

  @Get('vouchers')
  @Permissions('portal.vouchers.read')
  @UseInterceptors(CacheInterceptor)
  listVouchers(@Query() params: PortalAdminRecordQueryDto) {
    return this.list(
      this.vouchers,
      params,
      PortalAdminController.byUser(params),
    );
  }

  @Get('vouchers/:id')
  @Permissions('portal.vouchers.read')
  getVoucher(@Param('id', ParseIntPipe) id: number) {
    return this.vouchers.findOne(id);
  }

  @Post('vouchers')
  @Permissions('portal.vouchers.create')
  async createVoucher(@Body() dto: CreatePortalVoucherDto) {
    return this.mutate(this.vouchers.create(dto));
  }

  @Patch('vouchers/:id')
  @Permissions('portal.vouchers.update')
  async updateVoucher(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalVoucherDto,
  ) {
    return this.mutate(this.vouchers.update(id, dto));
  }

  @Delete('vouchers/:id')
  @Permissions('portal.vouchers.delete')
  async deleteVoucher(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.vouchers.remove(id));
  }

  @Post('vouchers/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.vouchers.delete')
  async bulkDeleteVouchers(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.vouchers.removeMany(dto.ids));
  }

  @Get('tickets')
  @Permissions('portal.tickets.read')
  @UseInterceptors(CacheInterceptor)
  listTickets(@Query() params: PortalAdminRecordQueryDto) {
    return this.list(
      this.tickets,
      params,
      PortalAdminController.byUser(params),
    );
  }

  @Get('tickets/:id')
  @Permissions('portal.tickets.read')
  getTicket(@Param('id', ParseIntPipe) id: number) {
    return this.tickets.findOne(id);
  }

  @Post('tickets')
  @Permissions('portal.tickets.create')
  async createTicket(@Body() dto: CreatePortalTicketDto) {
    return this.mutate(this.tickets.create(dto));
  }

  @Patch('tickets/:id')
  @Permissions('portal.tickets.update')
  async updateTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalTicketDto,
  ) {
    return this.mutate(this.tickets.update(id, dto));
  }

  @Delete('tickets/:id')
  @Permissions('portal.tickets.delete')
  async deleteTicket(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.tickets.remove(id));
  }

  @Post('tickets/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.tickets.delete')
  async bulkDeleteTickets(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.tickets.removeMany(dto.ids));
  }

  @Get('orders')
  @Permissions('portal.orders.read')
  @UseInterceptors(CacheInterceptor)
  listOrders(@Query() params: PortalAdminRecordQueryDto) {
    return this.list(this.orders, params, PortalAdminController.byUser(params));
  }

  @Get('orders/:id')
  @Permissions('portal.orders.read')
  getOrder(@Param('id', ParseIntPipe) id: number) {
    return this.orders.findOne(id);
  }

  @Post('orders')
  @Permissions('portal.orders.create')
  async createOrder(@Body() dto: CreatePortalOrderDto) {
    return this.mutate(this.orders.create(dto));
  }

  @Patch('orders/:id')
  @Permissions('portal.orders.update')
  async updateOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalOrderDto,
  ) {
    return this.mutate(this.orders.update(id, dto));
  }

  @Delete('orders/:id')
  @Permissions('portal.orders.delete')
  async deleteOrder(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.orders.remove(id));
  }

  @Post('orders/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.orders.delete')
  async bulkDeleteOrders(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.orders.removeMany(dto.ids));
  }

  @Get('orders/:orderId/items')
  @Permissions('portal.order_items.read')
  listOrderItems(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.orderItems.findByOrder(orderId);
  }

  @Post('orders/:orderId/items')
  @Permissions('portal.order_items.create')
  async createNestedOrderItem(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: CreatePortalOrderItemDto,
  ) {
    return this.mutate(this.orderItems.create({ ...dto, orderId }));
  }

  @Get('order-items')
  @Permissions('portal.order_items.read')
  @UseInterceptors(CacheInterceptor)
  listOrderItemsAll(@Query() params: PaginationParamsDto) {
    return this.list(this.orderItems, params);
  }

  @Post('order-items')
  @Permissions('portal.order_items.create')
  async createOrderItem(@Body() dto: CreatePortalOrderItemDto) {
    return this.mutate(this.orderItems.create(dto));
  }

  @Get('order-items/:id')
  @Permissions('portal.order_items.read')
  getOrderItem(@Param('id', ParseIntPipe) id: number) {
    return this.orderItems.findOne(id);
  }

  @Patch('order-items/:id')
  @Permissions('portal.order_items.update')
  async updateOrderItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalOrderItemDto,
  ) {
    return this.mutate(this.orderItems.update(id, dto));
  }

  @Delete('order-items/:id')
  @Permissions('portal.order_items.delete')
  async deleteOrderItem(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.orderItems.remove(id));
  }

  @Post('order-items/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.order_items.delete')
  async bulkDeleteOrderItems(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.orderItems.removeMany(dto.ids));
  }

  @Get('follows')
  @Permissions('portal.follows.read')
  @UseInterceptors(CacheInterceptor)
  listFollows(@Query() params: PortalAdminRecordQueryDto) {
    return this.list(
      this.follows,
      params,
      PortalAdminController.byUser(params),
    );
  }

  @Get('follows/:id')
  @Permissions('portal.follows.read')
  getFollow(@Param('id', ParseIntPipe) id: number) {
    return this.follows.findOne(id);
  }

  @Post('follows')
  @Permissions('portal.follows.create')
  async createFollow(@Body() dto: CreatePortalFollowDto) {
    return this.mutate(this.follows.create(dto));
  }

  @Patch('follows/:id')
  @Permissions('portal.follows.update')
  async updateFollow(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalFollowDto,
  ) {
    return this.mutate(this.follows.update(id, dto));
  }

  @Delete('follows/:id')
  @Permissions('portal.follows.delete')
  async deleteFollow(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.follows.remove(id));
  }

  @Post('follows/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.follows.delete')
  async bulkDeleteFollows(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.follows.removeMany(dto.ids));
  }

  @Get('campaign-progress')
  @Permissions('portal.campaign_progress.read')
  @UseInterceptors(CacheInterceptor)
  listCampaignProgress(@Query() params: PortalAdminRecordQueryDto) {
    return this.list(
      this.campaignProgress,
      params,
      PortalAdminController.byUser(params),
    );
  }

  @Get('campaign-progress/:id')
  @Permissions('portal.campaign_progress.read')
  getCampaignProgress(@Param('id', ParseIntPipe) id: number) {
    return this.campaignProgress.findOne(id);
  }

  @Get('otp-challenges')
  @Permissions('portal.email_otp_challenges.read')
  @UseInterceptors(CacheInterceptor)
  listOtpChallenges(@Query() params: PaginationParamsDto) {
    return this.list(this.otpChallenges, params);
  }

  @Get('otp-challenges/:id')
  @Permissions('portal.email_otp_challenges.read')
  getOtpChallenge(@Param('id', ParseIntPipe) id: number) {
    return this.otpChallenges.findOne(id);
  }

  @Post('otp-challenges')
  @Permissions('portal.email_otp_challenges.create')
  async createOtpChallenge(@Body() dto: CreatePortalEmailOtpChallengeDto) {
    return this.mutate(this.otpChallenges.create(dto));
  }

  @Patch('otp-challenges/:id')
  @Permissions('portal.email_otp_challenges.update')
  async updateOtpChallenge(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalEmailOtpChallengeDto,
  ) {
    return this.mutate(this.otpChallenges.update(id, dto));
  }

  @Delete('otp-challenges/:id')
  @Permissions('portal.email_otp_challenges.delete')
  async deleteOtpChallenge(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.otpChallenges.remove(id));
  }

  @Post('otp-challenges/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.email_otp_challenges.delete')
  async bulkDeleteOtpChallenges(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.otpChallenges.removeMany(dto.ids));
  }

  @Get('reviews')
  @Permissions('portal.reviews.read')
  @UseInterceptors(CacheInterceptor)
  listReviews(@Query() params: PortalAdminRecordQueryDto) {
    return this.list(
      this.reviews,
      params,
      PortalAdminController.byUser(params),
    );
  }

  @Get('reviews/:id')
  @Permissions('portal.reviews.read')
  getReview(@Param('id', ParseIntPipe) id: number) {
    return this.reviews.findOne(id);
  }

  @Patch('reviews/:id')
  @Permissions('portal.reviews.update')
  async moderateReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalReviewDto,
  ) {
    return this.mutate(this.reviews.update(id, dto));
  }

  @Delete('reviews/:id')
  @Permissions('portal.reviews.delete')
  async deleteReview(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.reviews.remove(id));
  }

  @Post('reviews/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.reviews.delete')
  async bulkDeleteReviews(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.reviews.removeMany(dto.ids));
  }

  @Get('promo-codes')
  @Permissions('portal.promo_codes.read')
  @UseInterceptors(CacheInterceptor)
  listPromoCodes(@Query() params: PaginationParamsDto) {
    return this.list(this.promoCodes, params);
  }

  @Get('promo-codes/:id')
  @Permissions('portal.promo_codes.read')
  getPromoCode(@Param('id', ParseIntPipe) id: number) {
    return this.promoCodes.findOne(id);
  }

  @Post('promo-codes')
  @Permissions('portal.promo_codes.create')
  async createPromoCode(@Body() dto: CreatePortalPromoCodeDto) {
    return this.mutate(this.promoCodes.create(dto));
  }

  @Patch('promo-codes/:id')
  @Permissions('portal.promo_codes.update')
  async updatePromoCode(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalPromoCodeDto,
  ) {
    return this.mutate(this.promoCodes.update(id, dto));
  }

  @Delete('promo-codes/:id')
  @Permissions('portal.promo_codes.delete')
  async deletePromoCode(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.promoCodes.remove(id));
  }

  @Post('promo-codes/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.promo_codes.delete')
  async bulkDeletePromoCodes(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.promoCodes.removeMany(dto.ids));
  }

  @Get('booking-slots')
  @Permissions('portal.booking_slots.read')
  @UseInterceptors(CacheInterceptor)
  listBookingSlots(@Query() params: PaginationParamsDto) {
    return this.list(this.bookingSlots, params);
  }

  @Get('booking-slots/:id')
  @Permissions('portal.booking_slots.read')
  getBookingSlot(@Param('id', ParseIntPipe) id: number) {
    return this.bookingSlots.findOne(id);
  }

  @Post('booking-slots')
  @Permissions('portal.booking_slots.create')
  async createBookingSlot(@Body() dto: CreatePortalBookingSlotDto) {
    return this.mutate(this.bookingSlots.create(dto));
  }

  @Patch('booking-slots/:id')
  @Permissions('portal.booking_slots.update')
  async updateBookingSlot(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalBookingSlotDto,
  ) {
    return this.mutate(this.bookingSlots.update(id, dto));
  }

  @Delete('booking-slots/:id')
  @Permissions('portal.booking_slots.delete')
  async deleteBookingSlot(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.bookingSlots.remove(id));
  }

  @Post('booking-slots/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.booking_slots.delete')
  async bulkDeleteBookingSlots(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.bookingSlots.removeMany(dto.ids));
  }

  @Get('bookings')
  @Permissions('portal.bookings.read')
  @UseInterceptors(CacheInterceptor)
  listBookings(@Query() params: PortalAdminRecordQueryDto) {
    return this.list(
      this.bookings,
      params,
      PortalAdminController.byUser(params),
    );
  }

  @Get('bookings/:id')
  @Permissions('portal.bookings.read')
  getBooking(@Param('id', ParseIntPipe) id: number) {
    return this.bookings.findOne(id);
  }

  @Patch('bookings/:id')
  @Permissions('portal.bookings.update')
  async updateBooking(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalBookingDto,
  ) {
    return this.mutate(this.bookings.update(id, dto));
  }

  @Delete('bookings/:id')
  @Permissions('portal.bookings.delete')
  async deleteBooking(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.bookings.remove(id));
  }

  @Post('bookings/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.bookings.delete')
  async bulkDeleteBookings(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.bookings.removeMany(dto.ids));
  }

  private static byUser(params: PortalAdminRecordQueryDto) {
    return params.userId ? { userId: params.userId } : {};
  }

  private list<TEntity extends ObjectLiteral>(
    service: BaseService<TEntity>,
    params: PaginationParamsDto,
    filters: FindOptionsWhere<TEntity> = {},
  ) {
    if (params.paginated) {
      return service.findAllPaginated(
        params.page,
        params.limit,
        params.search,
        params.sort,
        params.direction,
        [],
        filters,
      );
    }
    return service.findAll([], { where: filters });
  }

  private async mutate<T>(operation: Promise<T>) {
    const result = await operation;
    await this.cacheService.clearKeys('*/portal*');
    return result;
  }
}
