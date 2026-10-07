import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityTarget,
  FindOptionsWhere,
  IsNull,
  Not,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { BaseService } from '@/common/services/base.service';
import { User } from '@/users/entities/user.entity';
import { refreshCouponSummary } from '@/portal/catalog/coupon-packages';
import {
  deliverCommerceEvents,
  enqueueCommerceEvent,
} from '@/portal/commerce/commerce-events';
import { PortalCampaignLedger } from '@/portal/campaigns/entities/portal-campaign-ledger.entity';
import { PortalCommerceOutbox } from '@/portal/commerce/entities/portal-commerce-outbox.entity';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalBooking } from '@/portal/bookings/entities/portal-booking.entity';
import { PortalGift } from '@/portal/gifts/entities/portal-gift.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { PortalReferral } from '@/portal/campaigns/entities/portal-referral.entity';
import { PortalSavedOffer } from '@/portal/customer/entities/portal-saved-offer.entity';
import { PortalWalletTransaction } from '@/portal/commerce/entities/portal-wallet-transaction.entity';
import { PortalWallet } from '@/portal/commerce/entities/portal-wallet.entity';
import {
  PortalCustomerDto,
  PortalCustomerSummaryDto,
  PortalWalletAdjustmentDto,
  PortalWalletAdjustmentResponseDto,
} from './dto/admin-records.dto';

const READ_ONLY = 'This portal record is read-only in admin';

/**
 * Customer-owned or system-owned portal data that admin may inspect but not
 * edit through generic CRUD. Dedicated, audited actions live on the subclasses.
 */
abstract class PortalReadOnlyAdminService<
  T extends ObjectLiteral,
> extends BaseService<T> {
  override create(): Promise<T> {
    return Promise.reject(new ConflictException(READ_ONLY));
  }
  override update(): Promise<T> {
    return Promise.reject(new ConflictException(READ_ONLY));
  }
  override remove(): Promise<void> {
    return Promise.reject(new ConflictException(READ_ONLY));
  }
  override removeMany(): Promise<{ deleted: number }> {
    return Promise.reject(new ConflictException(READ_ONLY));
  }

  list(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      sort?: string;
      direction?: string;
      paginated?: boolean;
    },
    filters: FindOptionsWhere<T> = {},
  ) {
    if (params.paginated)
      return this.findAllPaginated(
        params.page,
        params.limit,
        params.search,
        params.sort,
        params.direction,
        [],
        filters,
      );
    return this.findAll([], { where: filters, order: { id: 'DESC' } as never });
  }
}

@Injectable()
export class PortalGiftAdminService extends PortalReadOnlyAdminService<PortalGift> {
  constructor(
    @InjectRepository(PortalGift) repository: Repository<PortalGift>,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {
    super(repository, 'PortalGift', [
      'code',
      'recipientName',
      'recipientEmail',
      'status',
    ]);
  }

  /** Cancels an unredeemed gift and returns its reserved package stock. */
  async revoke(id: number, actorId: number, reason: string) {
    const gift = await this.dataSource.transaction(async (manager) => {
      const gifts = manager.getRepository(PortalGift);
      const gift = await gifts.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!gift) throw new NotFoundException(`PortalGift #${id} not found`);
      if (gift.status !== 'Ready')
        throw new ConflictException('Only unredeemed gifts can be revoked');
      if (gift.packageId) {
        // Coupon before package, the order claims, gifts and checkout use, so a
        // revoke can't deadlock against them and the summary isn't stale.
        const coupon = await manager.getRepository(PortalCoupon).findOne({
          where: { id: gift.couponId },
          lock: { mode: 'pessimistic_write' },
        });
        const packages = manager.getRepository(PortalCouponPackage);
        const selected = await packages.findOne({
          where: { id: gift.packageId },
          lock: { mode: 'pessimistic_write' },
        });
        if (selected) {
          selected.stockRemaining = Math.min(
            selected.stockTotal,
            selected.stockRemaining + 1,
          );
          await packages.save(selected);
          if (coupon) await refreshCouponSummary(manager, coupon);
        }
      }
      gift.status = 'Revoked';
      const saved = await gifts.save(gift);
      await enqueueCommerceEvent(
        manager,
        `gift-revoke:${gift.id}`,
        'audit.record',
        {
          action: 'portal.gift_revoke',
          actorId,
          subjectType: 'PortalGift',
          subjectId: String(gift.id),
          summary: 'Gift revoked',
          metadata: { code: gift.code, reason },
        },
      );
      return saved;
    });
    await deliverCommerceEvents(this.dataSource, this.events);
    return gift;
  }
}

@Injectable()
export class PortalReferralAdminService extends PortalReadOnlyAdminService<PortalReferral> {
  constructor(
    @InjectRepository(PortalReferral) repository: Repository<PortalReferral>,
  ) {
    super(repository, 'PortalReferral', ['code']);
  }
}

@Injectable()
export class PortalSavedOfferAdminService extends PortalReadOnlyAdminService<PortalSavedOffer> {
  constructor(
    @InjectRepository(PortalSavedOffer)
    repository: Repository<PortalSavedOffer>,
  ) {
    super(repository, 'PortalSavedOffer', [
      'targetType',
      'targetKey',
      'targetName',
    ]);
  }
}

@Injectable()
export class PortalCampaignLedgerAdminService extends PortalReadOnlyAdminService<PortalCampaignLedger> {
  constructor(
    @InjectRepository(PortalCampaignLedger)
    repository: Repository<PortalCampaignLedger>,
  ) {
    super(repository, 'PortalCampaignLedger', ['sourceKey', 'kind', 'reason']);
  }
}

@Injectable()
export class PortalCommerceOutboxAdminService extends PortalReadOnlyAdminService<PortalCommerceOutbox> {
  constructor(
    @InjectRepository(PortalCommerceOutbox)
    repository: Repository<PortalCommerceOutbox>,
  ) {
    super(repository, 'PortalCommerceOutbox', ['operationKey', 'eventName']);
  }

  deliveredFilter(delivered?: boolean): FindOptionsWhere<PortalCommerceOutbox> {
    if (delivered === undefined) return {};
    return { deliveredAt: delivered ? Not(IsNull()) : IsNull() };
  }
}

@Injectable()
export class PortalWalletTransactionAdminService extends PortalReadOnlyAdminService<PortalWalletTransaction> {
  constructor(
    @InjectRepository(PortalWalletTransaction)
    repository: Repository<PortalWalletTransaction>,
  ) {
    super(repository, 'PortalWalletTransaction', ['type', 'description']);
  }
}

@Injectable()
export class PortalWalletAdminService extends PortalReadOnlyAdminService<PortalWallet> {
  constructor(
    @InjectRepository(PortalWallet) repository: Repository<PortalWallet>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {
    super(repository, 'PortalWallet', []);
  }

  /**
   * Credits or debits a customer's coins with an audited `adjustment`
   * transaction. Replaying the same idempotency key returns the current
   * balance without applying the amount again.
   */
  async adjust(
    dto: PortalWalletAdjustmentDto,
    actorId: number,
  ): Promise<PortalWalletAdjustmentResponseDto> {
    if (!(await this.users.findOneBy({ id: dto.userId })))
      throw new NotFoundException(`User #${dto.userId} not found`);
    const operationKey = `admin:${dto.idempotencyKey}`;
    const result = await this.dataSource.transaction(async (manager) => {
      const wallets = manager.getRepository(PortalWallet);
      const transactions = manager.getRepository(PortalWalletTransaction);
      // Create the wallet idempotently, then lock it before the duplicate
      // check: concurrent first adjustments (any keys) serialize on one row
      // instead of racing on the unique userId.
      await wallets
        .createQueryBuilder()
        .insert()
        .values({ userId: dto.userId, balance: 0, lifetimeEarned: 0 })
        .orIgnore()
        .execute();
      const wallet = await wallets.findOneOrFail({
        where: { userId: dto.userId },
        lock: { mode: 'pessimistic_write' },
      });
      const existing = await transactions.findOneBy({ operationKey });
      if (existing) {
        if (existing.userId !== dto.userId || existing.amount !== dto.amount)
          throw new ConflictException(
            'Idempotency key was already used for a different adjustment',
          );
        return { wallet, applied: false };
      }
      if (wallet.balance + dto.amount < 0)
        throw new ConflictException(
          'Adjustment would make the balance negative',
        );
      wallet.balance += dto.amount;
      if (dto.amount > 0) wallet.lifetimeEarned += dto.amount;
      await wallets.save(wallet);
      const transaction = await transactions.save(
        transactions.create({
          userId: dto.userId,
          type: 'adjustment',
          amount: dto.amount,
          description: `Admin adjustment: ${dto.reason}`.slice(0, 180),
          operationKey,
        }),
      );
      await enqueueCommerceEvent(
        manager,
        `wallet-adjust:${transaction.id}`,
        'audit.record',
        {
          action: 'portal.wallet_adjust',
          actorId,
          subjectType: 'PortalWallet',
          subjectId: String(wallet.id),
          summary: 'Wallet balance adjusted',
          metadata: {
            userId: dto.userId,
            amount: dto.amount,
            reason: dto.reason,
            balance: wallet.balance,
          },
        },
      );
      return { wallet, applied: true };
    });
    await deliverCommerceEvents(this.dataSource, this.events);
    return {
      userId: result.wallet.userId,
      balance: result.wallet.balance,
      lifetimeEarned: result.wallet.lifetimeEarned,
      applied: result.applied,
    };
  }
}

type CustomerRow = {
  id: number;
  email: string;
  fullname: string;
  phone: string | null;
  registerMethod: string;
  notificationsEnabled: boolean;
  createdAt: Date;
  orderCount: string;
  paidOrderCount: string;
  walletBalance: string | null;
  lastOrderAt: Date | null;
};

/** Portal customers are core users holding the auto-provisioned `customer` role. */
@Injectable()
export class PortalCustomerAdminService {
  constructor(private readonly dataSource: DataSource) {}

  /** Schema-qualified table for raw subqueries, matching the connection's schema. */
  private table(entity: EntityTarget<ObjectLiteral>) {
    const { schema, tableName } = this.dataSource.getMetadata(entity);
    return schema ? `"${schema}"."${tableName}"` : `"${tableName}"`;
  }

  private base() {
    return this.dataSource
      .createQueryBuilder()
      .from('users', 'u')
      .innerJoin('user_roles', 'ur', 'ur."userId" = u.id')
      .innerJoin('roles', 'r', `r.id = ur."roleId" AND r.name = 'customer'`)
      .leftJoin(
        'portal_wallets',
        'w',
        'w."userId" = u.id AND w."deletedAt" IS NULL',
      )
      .where('u."deletedAt" IS NULL')
      .select([
        'u.id AS id',
        'u.email AS email',
        'u.fullname AS fullname',
        'u.phone AS phone',
        'u."registerMethod" AS "registerMethod"',
        'u."notificationsEnabled" AS "notificationsEnabled"',
        'u."createdAt" AS "createdAt"',
        'w.balance AS "walletBalance"',
        'w."lifetimeEarned" AS "lifetimeEarned"',
      ])
      .addSelect(
        `(SELECT COUNT(*) FROM ${this.table(PortalOrder)} o WHERE o."userId" = u.id AND o."deletedAt" IS NULL)`,
        'orderCount',
      )
      .addSelect(
        `(SELECT COUNT(*) FROM ${this.table(PortalOrder)} o WHERE o."userId" = u.id AND o."deletedAt" IS NULL AND o."paidAt" IS NOT NULL)`,
        'paidOrderCount',
      )
      .addSelect(
        `(SELECT MAX(o."createdAt") FROM ${this.table(PortalOrder)} o WHERE o."userId" = u.id AND o."deletedAt" IS NULL)`,
        'lastOrderAt',
      );
  }

  private toDto(row: CustomerRow): PortalCustomerDto {
    return {
      id: Number(row.id),
      email: row.email,
      fullname: row.fullname,
      phone: row.phone,
      registerMethod: row.registerMethod,
      notificationsEnabled: row.notificationsEnabled,
      createdAt: row.createdAt,
      orderCount: Number(row.orderCount),
      paidOrderCount: Number(row.paidOrderCount),
      walletBalance: Number(row.walletBalance ?? 0),
      lastOrderAt: row.lastOrderAt,
    };
  }

  async list(page = 1, limit = 10, search?: string) {
    const query = this.base();
    if (search)
      query.andWhere('(u.email ILIKE :search OR u.fullname ILIKE :search)', {
        search: `%${search}%`,
      });
    const total = await query.clone().select('COUNT(*)', 'count').getRawOne<{
      count: string;
    }>();
    const currentPage = Math.max(1, page);
    const rows = await query
      .orderBy('u."createdAt"', 'DESC')
      .offset((currentPage - 1) * limit)
      .limit(limit)
      .getRawMany<CustomerRow>();
    const count = Number(total?.count ?? 0);
    return {
      data: rows.map((row) => this.toDto(row)),
      meta: {
        total: count,
        page: currentPage,
        lastPage: Math.ceil(count / limit),
      },
    };
  }

  async summary(id: number): Promise<PortalCustomerSummaryDto> {
    const row = await this.base()
      .andWhere('u.id = :id', { id })
      .addSelect(
        `(SELECT COUNT(*) FROM ${this.table(PortalVoucher)} v WHERE v."userId" = u.id AND v."deletedAt" IS NULL)`,
        'voucherCount',
      )
      .addSelect(
        `(SELECT COUNT(*) FROM ${this.table(PortalTicket)} t WHERE t."userId" = u.id AND t."deletedAt" IS NULL)`,
        'ticketCount',
      )
      .addSelect(
        `(SELECT COUNT(*) FROM ${this.table(PortalGift)} g WHERE g."senderUserId" = u.id AND g."deletedAt" IS NULL)`,
        'giftsSent',
      )
      .addSelect(
        `(SELECT COUNT(*) FROM ${this.table(PortalBooking)} b WHERE b."userId" = u.id AND b."deletedAt" IS NULL)`,
        'bookingCount',
      )
      .addSelect(
        `(SELECT code FROM ${this.table(PortalReferral)} rf WHERE rf."userId" = u.id)`,
        'referralCode',
      )
      .addSelect(
        `(SELECT "referrerUserId" FROM ${this.table(PortalReferral)} rf WHERE rf."userId" = u.id)`,
        'referredByUserId',
      )
      .addSelect(
        `(SELECT COUNT(*) FROM ${this.table(PortalReferral)} rf WHERE rf."referrerUserId" = u.id)`,
        'referredCount',
      )
      .getRawOne<
        CustomerRow & {
          lifetimeEarned: string | null;
          voucherCount: string;
          ticketCount: string;
          giftsSent: string;
          bookingCount: string;
          referralCode: string | null;
          referredByUserId: number | null;
          referredCount: string;
        }
      >();
    if (!row) throw new NotFoundException(`Customer #${id} not found`);
    return {
      ...this.toDto(row),
      lifetimeEarned: Number(row.lifetimeEarned ?? 0),
      voucherCount: Number(row.voucherCount),
      ticketCount: Number(row.ticketCount),
      giftsSent: Number(row.giftsSent),
      bookingCount: Number(row.bookingCount),
      referralCode: row.referralCode,
      referredByUserId:
        row.referredByUserId === null ? null : Number(row.referredByUserId),
      referredCount: Number(row.referredCount),
    };
  }
}
