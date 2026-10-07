import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CookieCsrfGuard } from '@/auth/cookie-csrf.guard';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import type { IAuthRequest } from '@/auth/interfaces/auth-request.interface';
import { Permissions } from '@/auth/permissions.decorator';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { CacheService } from '@/common/cache/cache.service';
import { PaginationParamsDto } from '@/common/dto/pagination-params.dto';
import {
  PortalAdminRecordQueryDto,
  PortalCustomerDto,
  PortalCustomerSummaryDto,
  PortalGiftQueryDto,
  PortalOutboxQueryDto,
  PortalWalletAdjustmentDto,
  PortalWalletAdjustmentResponseDto,
  RevokePortalGiftDto,
} from './dto/admin-records.dto';
import {
  PortalCampaignLedgerAdminService,
  PortalCommerceOutboxAdminService,
  PortalCustomerAdminService,
  PortalGiftAdminService,
  PortalReferralAdminService,
  PortalSavedOfferAdminService,
  PortalWalletAdminService,
  PortalWalletTransactionAdminService,
} from './portal-admin-records.service';

/**
 * Customer- and system-owned portal data. Lists are read-only and uncached so
 * balances and delivery state are current; writes are dedicated audited actions.
 */
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
export class PortalAdminRecordsController {
  constructor(
    private readonly gifts: PortalGiftAdminService,
    private readonly referrals: PortalReferralAdminService,
    private readonly wallets: PortalWalletAdminService,
    private readonly walletTransactions: PortalWalletTransactionAdminService,
    private readonly savedOffers: PortalSavedOfferAdminService,
    private readonly campaignLedger: PortalCampaignLedgerAdminService,
    private readonly outbox: PortalCommerceOutboxAdminService,
    private readonly customers: PortalCustomerAdminService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('customers')
  @Permissions('portal.customers.read')
  @ApiOkResponse({ type: [PortalCustomerDto] })
  listCustomers(@Query() params: PaginationParamsDto) {
    return this.customers.list(params.page, params.limit, params.search);
  }

  @Get('customers/:id')
  @Permissions('portal.customers.read')
  @ApiOkResponse({ type: PortalCustomerSummaryDto })
  getCustomer(@Param('id', ParseIntPipe) id: number) {
    return this.customers.summary(id);
  }

  @Get('gifts')
  @Permissions('portal.gifts.read')
  listGifts(@Query() params: PortalGiftQueryDto) {
    return this.gifts.list(params, {
      ...(params.userId ? { senderUserId: params.userId } : {}),
      ...(params.status ? { status: params.status } : {}),
    });
  }

  @Get('gifts/:id')
  @Permissions('portal.gifts.read')
  getGift(@Param('id', ParseIntPipe) id: number) {
    return this.gifts.findOne(id);
  }

  @Post('gifts/:id/revoke')
  @Permissions('portal.gifts.revoke')
  async revokeGift(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RevokePortalGiftDto,
    @Req() req: IAuthRequest,
  ) {
    return this.mutate(this.gifts.revoke(id, req.user.userId, dto.reason));
  }

  @Get('referrals')
  @Permissions('portal.referrals.read')
  listReferrals(@Query() params: PortalAdminRecordQueryDto) {
    return this.referrals.list(
      params,
      params.userId ? { userId: params.userId } : {},
    );
  }

  @Get('referrals/:id')
  @Permissions('portal.referrals.read')
  getReferral(@Param('id', ParseIntPipe) id: number) {
    return this.referrals.findOne(id);
  }

  @Get('wallets')
  @Permissions('portal.wallets.read')
  listWallets(@Query() params: PortalAdminRecordQueryDto) {
    return this.wallets.list(
      params,
      params.userId ? { userId: params.userId } : {},
    );
  }

  @Get('wallets/:id')
  @Permissions('portal.wallets.read')
  getWallet(@Param('id', ParseIntPipe) id: number) {
    return this.wallets.findOne(id);
  }

  @Post('wallets/adjustments')
  @Permissions('portal.wallets.adjust')
  @ApiCreatedResponse({ type: PortalWalletAdjustmentResponseDto })
  async adjustWallet(
    @Body() dto: PortalWalletAdjustmentDto,
    @Req() req: IAuthRequest,
  ) {
    return this.mutate(this.wallets.adjust(dto, req.user.userId));
  }

  @Get('wallet-transactions')
  @Permissions('portal.wallet_transactions.read')
  listWalletTransactions(@Query() params: PortalAdminRecordQueryDto) {
    return this.walletTransactions.list(
      params,
      params.userId ? { userId: params.userId } : {},
    );
  }

  @Get('wallet-transactions/:id')
  @Permissions('portal.wallet_transactions.read')
  getWalletTransaction(@Param('id', ParseIntPipe) id: number) {
    return this.walletTransactions.findOne(id);
  }

  @Get('saved-offers')
  @Permissions('portal.saved_offers.read')
  listSavedOffers(@Query() params: PortalAdminRecordQueryDto) {
    return this.savedOffers.list(
      params,
      params.userId ? { userId: params.userId } : {},
    );
  }

  @Get('saved-offers/:id')
  @Permissions('portal.saved_offers.read')
  getSavedOffer(@Param('id', ParseIntPipe) id: number) {
    return this.savedOffers.findOne(id);
  }

  @Get('campaign-ledger')
  @Permissions('portal.campaign_ledger.read')
  listCampaignLedger(@Query() params: PortalAdminRecordQueryDto) {
    return this.campaignLedger.list(
      params,
      params.userId ? { userId: params.userId } : {},
    );
  }

  @Get('campaign-ledger/:id')
  @Permissions('portal.campaign_ledger.read')
  getCampaignLedgerEntry(@Param('id', ParseIntPipe) id: number) {
    return this.campaignLedger.findOne(id);
  }

  @Get('commerce-outbox')
  @Permissions('portal.commerce_outbox.read')
  listCommerceOutbox(@Query() params: PortalOutboxQueryDto) {
    return this.outbox.list(
      params,
      this.outbox.deliveredFilter(params.delivered),
    );
  }

  @Get('commerce-outbox/:id')
  @Permissions('portal.commerce_outbox.read')
  getCommerceOutboxEvent(@Param('id', ParseIntPipe) id: number) {
    return this.outbox.findOne(id);
  }

  private async mutate<T>(operation: Promise<T>) {
    const result = await operation;
    await this.cacheService.clearKeys('*/portal*');
    return result;
  }
}
