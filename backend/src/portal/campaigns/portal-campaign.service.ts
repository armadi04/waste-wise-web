import {
  enqueueCommerceEvent,
  deliverCommerceEvents,
} from '@/portal/commerce/commerce-events';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  campaignLock,
  observeCampaign,
} from '@/portal/campaigns/campaign-observation';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';
import { PortalCampaignProgress } from '@/portal/campaigns/entities/portal-campaign-progress.entity';
import { PortalCampaignLedger } from '@/portal/campaigns/entities/portal-campaign-ledger.entity';
import { PortalReferral } from '@/portal/campaigns/entities/portal-referral.entity';
import { PortalPromoCode } from '@/portal/commerce/entities/portal-promo-code.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import { PortalOrderItem } from '@/portal/commerce/entities/portal-order-item.entity';
import { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { User } from '@/users/entities/user.entity';
import {
  campaignMatches,
  campaignRewardLabel,
} from '@/portal/campaigns/campaign-rules';
import { CampaignAdjustmentDto } from '@/portal/campaigns/dto/campaign-activity.dto';
import { PASS_STATUS } from '@/portal/passes/pass-status';
import { isTicketWindowOpen } from '@/portal/passes/ticket-window';

@Injectable()
export class PortalCampaignService {
  private readonly logger = new Logger(PortalCampaignService.name);
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2 = new EventEmitter2(),
  ) {}

  // Every commerce mutation takes these locks before order/product/promo row locks.
  // Include the referrer to serialize rewards to either recipient in a stable order.
  async lockCommerce(manager: EntityManager, userId: number) {
    await campaignLock(manager, false);
    const referral = await manager
      .getRepository(PortalReferral)
      .findOneBy({ userId });
    const ids = [
      ...new Set([
        userId,
        ...(referral?.referrerUserId ? [referral.referrerUserId] : []),
      ]),
    ].sort((a, b) => a - b);
    for (const id of ids) await campaignLock(manager, false, id);
    return referral;
  }

  async getReferral(userId: number) {
    return observeCampaign('getReferral', () =>
      this.dataSource.transaction(async (manager) => {
        await this.lockCommerce(manager, userId);
        const repository = manager.getRepository(PortalReferral);
        let referral = await repository.findOneBy({ userId });
        if (!referral)
          referral = await repository.save(
            repository.create({
              userId,
              code: `REF-${randomBytes(12).toString('hex').toUpperCase()}`,
              referrerUserId: null,
              firstOrderId: null,
            }),
          );
        const paid = await manager
          .getRepository(PortalOrder)
          .createQueryBuilder('o')
          .where('o.userId = :userId', { userId })
          .andWhere('o.paidAt IS NOT NULL')
          .getCount();
        return {
          code: referral.code,
          hasReferrer: referral.referrerUserId !== null,
          canConfirm: referral.referrerUserId === null && paid === 0,
        };
      }),
    );
  }

  async confirmReferral(userId: number, code: string) {
    return observeCampaign('confirmReferral', () =>
      this.dataSource.transaction(async (manager) => {
        // Serialize attribution changes. Payment re-reads attribution after user locks.
        await campaignLock(manager, true);
        const repository = manager.getRepository(PortalReferral);
        const referrer = await repository.findOneBy({ code });
        if (!referrer) throw new NotFoundException('Referral code not found');
        if (referrer.userId === userId)
          throw new BadRequestException('Self referral is not allowed');
        for (const id of [userId, referrer.userId].sort((a, b) => a - b))
          await campaignLock(manager, false, id);
        const paid = await manager
          .getRepository(PortalOrder)
          .createQueryBuilder('o')
          .where('o.userId = :userId', { userId })
          .andWhere('o.paidAt IS NOT NULL')
          .getCount();
        if (paid)
          throw new ConflictException(
            'Referral must be confirmed before the first payment',
          );
        let referral = await repository.findOneBy({ userId });
        if (
          referral?.referrerUserId !== null &&
          referral?.referrerUserId !== undefined
        ) {
          if (referral.referrerUserId === referrer.userId)
            return { confirmed: true };
          throw new ConflictException('Referrer cannot be changed');
        }
        const visited = new Set([userId]);
        let current: PortalReferral | null = referrer;
        while (current) {
          if (visited.has(current.userId))
            throw new ConflictException('Referral cycle is not allowed');
          visited.add(current.userId);
          current = current.referrerUserId
            ? await repository.findOneBy({ userId: current.referrerUserId })
            : null;
        }
        referral ??= repository.create({
          userId,
          code: `REF-${randomBytes(12).toString('hex').toUpperCase()}`,
          firstOrderId: null,
        });
        referral.referrerUserId = referrer.userId;
        await repository.save(referral);
        return { confirmed: true };
      }),
    );
  }

  private async orderProduct(manager: EntityManager, orderId: number) {
    const item = await manager
      .getRepository(PortalOrderItem)
      .findOneBy({ orderId });
    if (!item) return {};
    if (item.productType === 'bundle')
      return {
        couponId: item.benefitSnapshot?.couponId ?? undefined,
        eventId: item.benefitSnapshot?.eventId ?? undefined,
      };
    if (item.productType === 'coupon') return { couponId: item.productId };
    if (item.productType === 'ticket') {
      const type = await manager
        .getRepository(PortalEventTicket)
        .findOneBy({ id: item.productId });
      return { eventId: type?.eventId };
    }
    return {};
  }

  async paid(manager: EntityManager, order: PortalOrder) {
    if (order.total <= 0) return;
    const product = await this.orderProduct(manager, order.id);
    await this.award(
      manager,
      order.userId,
      'payment',
      `payment:${order.id}`,
      order.id,
      order.paidAt!,
      product,
    );
    const referrals = manager.getRepository(PortalReferral);
    const referral = await referrals.findOneBy({ userId: order.userId });
    if (!referral?.referrerUserId || referral.firstOrderId !== null) return;
    const otherPayments = await manager
      .getRepository(PortalOrder)
      .createQueryBuilder('o')
      .where('o.userId = :userId', { userId: order.userId })
      .andWhere('o.paidAt IS NOT NULL')
      .andWhere('o.id != :id', { id: order.id })
      .getCount();
    if (otherPayments) return;
    referral.firstOrderId = order.id;
    await referrals.save(referral);
    await this.award(
      manager,
      referral.referrerUserId,
      'referral',
      `referral:${order.userId}`,
      order.id,
      order.paidAt!,
      product,
    );
  }

  private async award(
    manager: EntityManager,
    userId: number,
    kind: 'payment' | 'usage' | 'referral',
    sourceKey: string,
    orderId: number | null,
    at: Date,
    product: { couponId?: number; eventId?: number },
    actorId: number | null = null,
  ) {
    const campaigns = await manager
      .getRepository(PortalCampaign)
      .createQueryBuilder('campaign')
      .where('campaign.active = true')
      .andWhere('campaign.rules IS NOT NULL')
      .andWhere(`(campaign.rules->>'${kind}Points')::int > 0`)
      .andWhere(`(campaign.rules->>'startsAt')::timestamptz <= :at`, { at })
      .setLock('pessimistic_read')
      .orderBy('campaign.id', 'ASC')
      .getMany();
    for (const campaign of campaigns) {
      if (
        !campaign?.rules ||
        new Date(campaign.rules.startsAt) > at ||
        !campaignMatches(campaign.rules, product)
      )
        continue;
      const points = campaign.rules[`${kind}Points`];
      if (points <= 0) continue;
      try {
        await this.entry(manager, campaign, userId, {
          sourceKey,
          kind,
          points,
          orderId,
          actorId,
          reason: `Verified ${kind}`,
        });
      } catch (error) {
        this.logger.error({
          event: 'campaign_points_failed',
          campaignId: campaign.id,
          userId,
          orderId,
          sourceKey,
          errorType: error instanceof Error ? error.name : 'Unknown',
        });
        throw error;
      }
    }
  }

  private async entry(
    manager: EntityManager,
    campaign: PortalCampaign,
    userId: number,
    input: Pick<
      PortalCampaignLedger,
      'sourceKey' | 'kind' | 'points' | 'orderId' | 'actorId' | 'reason'
    >,
  ) {
    const ledger = manager.getRepository(PortalCampaignLedger);
    if (
      await ledger.findOneBy({
        campaignId: campaign.id,
        userId,
        sourceKey: input.sourceKey,
      })
    )
      return;
    const progressRepository = manager.getRepository(PortalCampaignProgress);
    let progress = await progressRepository.findOne({
      where: { campaignId: campaign.id, userId },
      withDeleted: true,
    });
    if (!progress)
      progress = progressRepository.create({
        campaignId: campaign.id,
        userId,
        points: 0,
        targetPoints: campaign.targetPoints,
        status: 'pending',
      });
    const balance = progress.points + input.points;
    if (
      !Number.isSafeInteger(balance) ||
      balance < -2147483647 ||
      balance > 2147483647 ||
      (input.kind === 'adjustment' && input.points < 0 && balance < 0)
    )
      throw new ConflictException('Invalid campaign balance');
    await ledger.save(
      ledger.create({ ...input, campaignId: campaign.id, userId }),
    );
    progress.deletedAt = null;
    progress.points = balance;
    progress.status = balance >= progress.targetPoints ? 'eligible' : 'pending';
    await progressRepository.save(progress);
    await this.syncReward(manager, campaign, progress);
  }

  private async syncReward(
    manager: EntityManager,
    campaign: PortalCampaign,
    progress: PortalCampaignProgress,
  ) {
    const promos = manager.getRepository(PortalPromoCode);
    let promo = await promos.findOne({
      where: { campaignId: campaign.id, ownerUserId: progress.userId },
      lock: { mode: 'pessimistic_write' },
      withDeleted: true,
    });
    const eligible = progress.points >= progress.targetPoints;
    if (promo) {
      if (promo.consumedAt || promo.deletedAt || promo.expiresAt <= new Date())
        return;
      if (!eligible) {
        promo.active = false;
        promo.revokedAt ??= new Date();
      } else if (promo.revokedAt) {
        promo.active = true;
        promo.revokedAt = null;
      }
      await promos.save(promo);
      return;
    }
    if (!eligible || !campaign.rules) return;
    promo = promos.create({
      ...campaign.rules.reward,
      code: `CMP-${randomBytes(12).toString('hex').toUpperCase()}`,
      ownerUserId: progress.userId,
      campaignId: campaign.id,
      usageLimit: 1,
      usageCount: 0,
      active: true,
      expiresAt: new Date(Date.now() + 30 * 86400000),
      reservedOrderId: null,
      consumedAt: null,
      revokedAt: null,
    });
    await promos.save(promo);
  }

  async refund(manager: EntityManager, order: PortalOrder) {
    const entries = await manager.getRepository(PortalCampaignLedger).find({
      where: {
        orderId: order.id,
        kind: In(['payment', 'usage', 'referral']),
      },
      order: { campaignId: 'ASC', userId: 'ASC', id: 'ASC' },
    });
    for (const earned of entries) {
      const campaign = await manager
        .getRepository(PortalCampaign)
        .findOne({ where: { id: earned.campaignId }, withDeleted: true });
      if (campaign)
        await this.entry(manager, campaign, earned.userId, {
          sourceKey: `reversal:${earned.id}`,
          kind: 'reversal',
          points: -earned.points,
          orderId: order.id,
          actorId: null,
          reason: 'Order refunded',
        });
    }
  }

  async verifyUsage(kind: 'voucher' | 'ticket', id: number, actorId: number) {
    const record = (outcome: string) =>
      this.events.emit('audit.record', {
        action:
          kind === 'voucher'
            ? 'portal.voucher_redeem'
            : 'portal.ticket_check_in',
        actorId,
        subjectType: kind === 'voucher' ? 'PortalVoucher' : 'PortalTicket',
        subjectId: String(id),
        summary: 'Pass usage verification',
        metadata: { outcome, checkedAt: new Date().toISOString() },
      });
    try {
      const result = await this.verifyUsageTransaction(kind, id, actorId);
      await deliverCommerceEvents(this.dataSource, this.events);
      if (result.repeated) record('repeated');
      return { verified: true };
    } catch (error) {
      record('rejected');
      throw error;
    }
  }

  private async verifyUsageTransaction(
    kind: 'voucher' | 'ticket',
    id: number,
    actorId: number,
  ) {
    return observeCampaign('verifyUsage', () =>
      this.dataSource.transaction(async (manager) => {
        const repository =
          kind === 'voucher'
            ? manager.getRepository(PortalVoucher)
            : manager.getRepository(PortalTicket);
        const snapshot = await repository.findOneBy({ id });
        if (!snapshot) throw new NotFoundException('Owned resource not found');
        await this.lockCommerce(manager, snapshot.userId);
        if (!snapshot.orderItemId) {
          if (kind !== 'voucher')
            throw new ConflictException(
              'Historical ticket has no verified order link',
            );
          const voucher = await manager.getRepository(PortalVoucher).findOne({
            where: { id },
            lock: { mode: 'pessimistic_write' },
          });
          if (
            !voucher ||
            voucher.userId !== snapshot.userId ||
            voucher.orderItemId
          )
            throw new ConflictException('Resource issuance changed');
          if (voucher.status === PASS_STATUS.Redeemed)
            return { verified: true, repeated: true };
          if (
            voucher.status !== PASS_STATUS.Issued ||
            voucher.expiresAt <= new Date()
          )
            throw new ConflictException('Voucher is invalid or expired');
          // Claimed/gift/legacy vouchers remain usable, but have no paid-order proof for points.
          await manager.getRepository(PortalVoucher).save({
            ...voucher,
            status: PASS_STATUS.Redeemed,
            redeemedAt: new Date(),
          });
          await this.queueUsageAudit(manager, kind, id, actorId);
          return { verified: true, repeated: false };
        }
        const item = await manager
          .getRepository(PortalOrderItem)
          .findOneBy({ id: snapshot.orderItemId });
        if (!item) throw new ConflictException('Order item not found');
        const order = await manager.getRepository(PortalOrder).findOne({
          where: { id: item.orderId, userId: snapshot.userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !order ||
          order.status !== 'Paid' ||
          ['Requested', 'Processing', 'Failed'].includes(
            order.refundStatus ?? '',
          )
        )
          throw new ConflictException('Usage requires a paid order');
        const resource = await repository.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !resource ||
          resource.orderItemId !== item.id ||
          resource.userId !== snapshot.userId
        )
          throw new ConflictException('Resource issuance changed');
        const usedStatus =
          kind === 'voucher' ? PASS_STATUS.Redeemed : PASS_STATUS.CheckedIn;
        if (resource.status === usedStatus)
          return { verified: true, repeated: true };
        if (resource.status !== PASS_STATUS.Issued)
          throw new ConflictException('Resource cannot be used');
        if (kind === 'voucher') {
          const voucher = resource as PortalVoucher;
          if (
            (item &&
              (item.productType !== 'coupon' ||
                item.productId !== voucher.couponId)) ||
            voucher.expiresAt <= new Date()
          )
            throw new ConflictException('Voucher is invalid or expired');
          voucher.redeemedAt = new Date();
          await manager
            .getRepository(PortalVoucher)
            .save({ ...voucher, status: usedStatus });
        } else {
          const ticket = resource as PortalTicket;
          const event = await manager
            .getRepository(PortalEvent)
            .findOneBy({ id: ticket.eventId });
          if (
            !item ||
            item.productType !== 'ticket' ||
            item.productId !== ticket.ticketTypeId ||
            !event ||
            !isTicketWindowOpen(event.startsAt)
          )
            throw new ConflictException('Ticket is invalid or expired');
          ticket.checkedInAt = new Date();
          await manager
            .getRepository(PortalTicket)
            .save({ ...ticket, status: usedStatus });
        }
        await this.award(
          manager,
          resource.userId,
          'usage',
          `${kind}:${id}`,
          order.id,
          new Date(),
          await this.orderProduct(manager, order.id),
          actorId,
        );
        await this.queueUsageAudit(manager, kind, id, actorId);
        return { verified: true, repeated: false };
      }),
    );
  }

  private async queueUsageAudit(
    manager: EntityManager,
    kind: 'voucher' | 'ticket',
    id: number,
    actorId: number,
  ) {
    await enqueueCommerceEvent(manager, `usage:${kind}:${id}`, 'audit.record', {
      action:
        kind === 'voucher' ? 'portal.voucher_redeem' : 'portal.ticket_check_in',
      actorId,
      subjectType: kind === 'voucher' ? 'PortalVoucher' : 'PortalTicket',
      subjectId: String(id),
      summary: 'Pass usage verification',
      metadata: { outcome: 'verified', checkedAt: new Date().toISOString() },
    });
  }

  async adjust(dto: CampaignAdjustmentDto, actorId: number) {
    if (dto.points === 0)
      throw new BadRequestException('Adjustment must change points');
    return observeCampaign('adjust', () =>
      this.dataSource.transaction(async (manager) => {
        await this.lockCommerce(manager, dto.userId);
        if (!(await manager.getRepository(User).findOneBy({ id: dto.userId })))
          throw new NotFoundException('User not found');
        const campaign = await manager.getRepository(PortalCampaign).findOne({
          where: { id: dto.campaignId },
          lock: { mode: 'pessimistic_read' },
        });
        if (!campaign) throw new NotFoundException('Campaign not found');
        const previous = await manager
          .getRepository(PortalCampaignLedger)
          .findOneBy({
            campaignId: dto.campaignId,
            userId: dto.userId,
            sourceKey: `adjustment:${dto.idempotencyKey}`,
          });
        if (
          previous &&
          (previous.points !== dto.points || previous.reason !== dto.reason)
        )
          throw new ConflictException('Adjustment key already used');
        await this.entry(manager, campaign, dto.userId, {
          kind: 'adjustment',
          sourceKey: `adjustment:${dto.idempotencyKey}`,
          points: dto.points,
          reason: dto.reason,
          actorId,
          orderId: null,
        });
        return { adjusted: true };
      }),
    );
  }

  async progress(userId: number, slug: string) {
    const campaign = await this.dataSource
      .getRepository(PortalCampaign)
      .findOneBy({ slug, active: true });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const progress = await this.dataSource
      .getRepository(PortalCampaignProgress)
      .findOneBy({ userId, campaignId: campaign.id });
    const promo = await this.dataSource
      .getRepository(PortalPromoCode)
      .findOneBy({ ownerUserId: userId, campaignId: campaign.id });
    return this.serializeProgress(campaign, progress, promo);
  }

  /** Active campaigns with the user's progress; points accrue without enrolment. */
  async mine(userId: number, page: number, limit: number) {
    const [campaigns, total] = await this.dataSource
      .getRepository(PortalCampaign)
      .findAndCount({
        where: { active: true },
        order: { createdAt: 'DESC', id: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
    const ids = campaigns.map((campaign) => campaign.id);
    const [progressRows, promos] = ids.length
      ? await Promise.all([
          this.dataSource
            .getRepository(PortalCampaignProgress)
            .find({ where: { userId, campaignId: In(ids) } }),
          this.dataSource
            .getRepository(PortalPromoCode)
            .find({ where: { ownerUserId: userId, campaignId: In(ids) } }),
        ])
      : [[], []];
    const progressByCampaign = new Map(
      progressRows.map((row) => [row.campaignId, row]),
    );
    const promoByCampaign = new Map(
      promos.map((promo) => [promo.campaignId, promo]),
    );
    return {
      data: campaigns.map((campaign) => {
        const progress = progressByCampaign.get(campaign.id);
        return {
          slug: campaign.slug,
          title: campaign.title,
          rewardLabel: campaign.rules
            ? campaignRewardLabel(campaign.rules)
            : campaign.rewardLabel,
          imageUrl: campaign.imageUrl,
          participating: Boolean(progress),
          progress: this.serializeProgress(
            campaign,
            progress,
            promoByCampaign.get(campaign.id),
          ),
        };
      }),
      meta: { total, page, lastPage: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  private serializeProgress(
    campaign: PortalCampaign,
    progress: PortalCampaignProgress | null | undefined,
    promo: PortalPromoCode | null | undefined,
  ) {
    const status = !promo
      ? 'unavailable'
      : promo.consumedAt
        ? 'used'
        : promo.expiresAt <= new Date()
          ? 'expired'
          : promo.revokedAt || !promo.active
            ? 'revoked'
            : promo.reservedOrderId !== null
              ? 'reserved'
              : 'available';
    return {
      points: Math.max(0, progress?.points ?? 0),
      targetPoints: progress?.targetPoints ?? campaign.targetPoints,
      status: progress?.status ?? 'pending',
      eligible: !!progress && progress.points >= progress.targetPoints,
      reward: promo
        ? {
            status,
            code:
              status === 'available' || status === 'reserved'
                ? promo.code
                : null,
            expiresAt: promo.expiresAt,
          }
        : null,
    };
  }

  async history(userId: number, slug: string, page: number, limit: number) {
    const campaign = await this.dataSource
      .getRepository(PortalCampaign)
      .findOneBy({ slug, active: true });
    if (!campaign) throw new NotFoundException('Campaign not found');
    const [rows, total] = await this.dataSource
      .getRepository(PortalCampaignLedger)
      .findAndCount({
        where: { userId, campaignId: campaign.id },
        order: { id: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
    return {
      data: rows.map(({ id, kind, points, reason, createdAt }) => ({
        id,
        kind,
        points,
        reason,
        createdAt,
      })),
      meta: { total, page, lastPage: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  assertPromoOwner(promo: PortalPromoCode, userId: number) {
    if (
      promo.ownerUserId !== null &&
      promo.ownerUserId !== undefined &&
      promo.ownerUserId !== userId
    )
      throw new ForbiddenException('Promo belongs to another user');
    if (
      promo.campaignId &&
      (promo.consumedAt || promo.revokedAt || promo.reservedOrderId !== null)
    )
      throw new ConflictException('Campaign reward is unavailable');
  }
}
