import type { OrderItemProductType } from '@/portal/commerce/order-item';
import {
  canRequestOrderRefund,
  hasUsedBenefit,
  USED_BENEFIT_STATUSES,
  REFUND_REQUEST_ACTIVE_STATUSES,
} from '@/portal/commerce/order-refund-policy';
import { OrderQueryDto } from '@/portal/commerce/dto/order-query.dto';
import {
  enqueueCommerceEvent,
  deliverCommerceEvents,
} from '@/portal/commerce/commerce-events';
import {
  type BenefitSnapshot,
  type PurchaseItemSnapshot,
  type PurchaseSnapshot,
} from '@/portal/commerce/commerce-purchase';
import {
  normalizePurchase,
  splitValue,
  saleDeadline,
  assertPurchaseLimit,
} from '@/portal/commerce/commerce-purchase';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LessThanOrEqual, EntityManager } from 'typeorm';
import {
  assertPaymentSandbox,
  paymentSandboxEnabled,
  paymentExpired,
  PAYMENT_TTL_MS,
} from '@/portal/commerce/payment-sandbox';
import { observeCampaign } from '@/portal/campaigns/campaign-observation';
import { PortalCampaignService } from '@/portal/campaigns/portal-campaign.service';
import { lockEventTicket } from '@/portal/catalog/event-availability';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  Raw,
  Repository,
  type FindOptionsWhere,
} from 'typeorm';
import { randomUUID } from 'node:crypto';
import { PortalBundle } from '@/portal/catalog/entities/portal-bundle.entity';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import {
  assertPackageAvailable,
  lockCouponPackage,
  packageSnapshot,
  refreshCouponSummary,
} from '@/portal/catalog/coupon-packages';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import { PortalOrderItem } from '@/portal/commerce/entities/portal-order-item.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { PortalWallet } from '@/portal/commerce/entities/portal-wallet.entity';
import { PortalWalletTransaction } from '@/portal/commerce/entities/portal-wallet-transaction.entity';
import { PortalPromoCode } from '@/portal/commerce/entities/portal-promo-code.entity';
import { CreatePortalOrderDto } from '@/portal/commerce/dto/order.dto';
import { PayPortalOrderDto } from '@/portal/commerce/dto/payment.dto';
import { PortalPaymentWebhookDto } from '@/portal/commerce/dto/payment-webhook.dto';
import { parseDatabaseId } from '@/common/utils/database-id';
import { PASS_STATUS } from '@/portal/passes/pass-status';
import { Injectable } from '@nestjs/common';
import { pageMeta } from '@/portal/shared/page-meta';
import { portalRuntimeConfig } from '@/config/portal-runtime.config';

@Injectable()
export class PortalCommerceService {
  constructor(
    @InjectRepository(PortalOrder)
    private readonly orderRepository: Repository<PortalOrder>,
    private readonly dataSource: DataSource,
    private readonly campaigns: PortalCampaignService,
    private readonly events: EventEmitter2,
  ) {}
  async getPurchaseLimit(
    userId: number,
    kind: 'coupon' | 'ticket' | 'bundle',
    slug: string,
  ) {
    const manager = this.dataSource.manager;
    const resources: Array<{
      key: string;
      product: { maxPerUser?: number | null };
    }> = [];
    if (kind === 'coupon') {
      const coupon = await manager
        .getRepository(PortalCoupon)
        .findOneBy({ slug, active: true });
      if (!coupon) throw new NotFoundException('Coupon not found');
      resources.push({ key: `coupon:${coupon.id}`, product: coupon });
    } else if (kind === 'ticket') {
      const event = await manager
        .getRepository(PortalEvent)
        .findOneBy({ slug, active: true });
      if (!event) throw new NotFoundException('Event not found');
      resources.push({ key: `event:${event.id}`, product: event });
    } else {
      const bundle = await manager
        .getRepository(PortalBundle)
        .findOneBy({ slug, active: true });
      if (!bundle) throw new NotFoundException('Bundle not found');
      if (
        !bundle.packageId ||
        !bundle.ticketTypeId ||
        bundle.componentsNeedReview
      )
        throw new ConflictException('Bundle components are not configured');
      const coupon = await manager
        .getRepository(PortalCoupon)
        .findOneBy({ slug: bundle.couponSlug, active: true });
      const event = await manager
        .getRepository(PortalEvent)
        .findOneBy({ slug: bundle.eventSlug, active: true });
      if (!coupon || !event)
        throw new ConflictException('Bundle components are unavailable');
      resources.push(
        { key: `bundle:${bundle.id}`, product: bundle },
        { key: `coupon:${coupon.id}`, product: coupon },
        { key: `event:${event.id}`, product: event },
      );
    }
    const now = await this.commerceNow(manager);
    const remaining: number[] = [];
    for (const { key, product } of resources) {
      if (product.maxPerUser != null) {
        const used = await this.usedPurchaseQuantity(manager, userId, key, now);
        remaining.push(Math.max(0, product.maxPerUser - used));
      }
    }
    return { remaining: remaining.length ? Math.min(...remaining) : null };
  }

  async createOrder(
    userId: number,
    dto: CreatePortalOrderDto,
    idempotencyKey: string,
  ) {
    if (!idempotencyKey)
      throw new BadRequestException('Idempotency-Key header is required');
    const { input, fingerprint } = normalizePurchase(dto);
    const quantity = input.quantity;
    return observeCampaign('createOrder', () =>
      this.dataSource.transaction(async (manager) => {
        await this.campaigns.lockCommerce(manager, userId);
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
          [String(userId), idempotencyKey],
        );
        let now = await this.commerceNow(manager);
        const orders = manager.getRepository(PortalOrder);
        const existing = await orders.findOneBy({ userId, idempotencyKey });
        if (existing) {
          if (existing.requestFingerprint !== fingerprint)
            throw new ConflictException({
              message: 'Idempotency key does not match this request',
              orderNumber: existing.orderNumber,
            });
          return this.serializeOrder(existing, manager);
        }
        let coupon: PortalCoupon | null = null;
        let selectedPackage: PortalCouponPackage | null = null;
        let event: PortalEvent | null = null;
        let ticket: PortalEventTicket | null = null;
        let bundle: PortalBundle | null = null;
        if (input.kind === 'bundle') {
          bundle = await manager.getRepository(PortalBundle).findOne({
            where: { slug: input.slug, active: true },
            lock: { mode: 'pessimistic_write' },
          });
          if (
            !bundle ||
            !bundle.packageId ||
            !bundle.ticketTypeId ||
            bundle.componentsNeedReview
          )
            throw new ConflictException('Bundle configuration is incomplete');
        }
        // Always reserve coupon before ticket, including bundle components.
        if (input.kind === 'coupon' || bundle) {
          coupon = await manager.getRepository(PortalCoupon).findOne({
            where: { slug: bundle?.couponSlug ?? input.slug, active: true },
            loadEagerRelations: false,
            lock: { mode: 'pessimistic_write' },
          });
          if (!coupon) throw new NotFoundException('Coupon not found');
          selectedPackage = bundle
            ? await manager.getRepository(PortalCouponPackage).findOne({
                where: {
                  id: bundle.packageId!,
                  couponId: coupon.id,
                  active: true,
                },
                lock: { mode: 'pessimistic_write' },
              })
            : await lockCouponPackage(
                manager,
                coupon.id,
                input.packagePublicId ?? undefined,
              );
          if (!selectedPackage || selectedPackage.stockRemaining < quantity)
            throw new ConflictException('Insufficient coupon stock');
          assertPackageAvailable(selectedPackage);
          if (coupon.validityDays && !coupon.salesEndsAt)
            throw new ConflictException(
              'Duration voucher requires a sale deadline',
            );
        }
        if (input.kind === 'ticket' || bundle) {
          event = await manager
            .getRepository(PortalEvent)
            .findOneBy({ slug: bundle?.eventSlug ?? input.slug, active: true });
          if (!event) throw new NotFoundException('Event not found');
          ticket = bundle
            ? await lockEventTicket(manager, { id: bundle.ticketTypeId! })
            : await lockEventTicket(manager, {
                eventId: event.id,
                name: input.ticketType ?? 'Early Bird',
              });
          if (
            !ticket ||
            ticket.eventId !== event.id ||
            ticket.stockRemaining < quantity
          )
            throw new ConflictException('Insufficient ticket stock');
        }
        now = await this.commerceNow(manager);
        const resources = [
          ...(bundle ? [{ key: `bundle:${bundle.id}`, product: bundle }] : []),
          ...(coupon ? [{ key: `coupon:${coupon.id}`, product: coupon }] : []),
          ...(event ? [{ key: `event:${event.id}`, product: event }] : []),
        ];
        for (const resource of resources) {
          const used =
            resource.product.maxPerUser == null
              ? 0
              : await this.usedPurchaseQuantity(
                  manager,
                  userId,
                  resource.key,
                  now,
                );
          assertPurchaseLimit(quantity, resource.product, used);
        }
        const paymentExpiresAt = saleDeadline(
          new Date(now.getTime() + PAYMENT_TTL_MS),
          coupon?.salesEndsAt ?? coupon?.expiresAt,
          coupon && !coupon.validityDays ? coupon.expiresAt : null,
          ticket?.salesEndsAt,
          event?.startsAt,
        );
        if (paymentExpiresAt <= now)
          throw new ConflictException('Product sales have ended');
        const unitPrice =
          bundle?.price ?? selectedPackage?.price ?? ticket?.price ?? 0;
        const subtotal = unitPrice * quantity;
        if (!Number.isSafeInteger(subtotal) || subtotal > 2147483647)
          throw new BadRequestException('Order amount is too large');
        const title = bundle?.title ?? coupon?.title ?? event!.title;
        let discount = 0;
        let promo: PortalPromoCode | null = null;
        if (input.promoCode) {
          promo = await manager.getRepository(PortalPromoCode).findOne({
            where: { code: input.promoCode, active: true },
            lock: { mode: 'pessimistic_write' },
          });
          if (!promo) throw new NotFoundException('Promo code not found');
          this.campaigns.assertPromoOwner(promo, userId);
          if (promo.expiresAt <= now)
            throw new ConflictException('Promo code has expired');
          const pending = (
            await orders.find({
              where: { promoCode: promo.code, status: 'Pending' },
            })
          ).filter(
            (order) => !paymentExpired(order.paymentExpiresAt, now),
          ).length;
          if (
            promo.usageLimit != null &&
            promo.usageCount + pending >= promo.usageLimit
          )
            throw new ConflictException('Promo code usage limit reached');
          if (subtotal < promo.minimumOrder)
            throw new ConflictException('Order does not meet promo minimum');
          discount = Math.min(
            subtotal,
            promo.maximumDiscount ?? subtotal,
            promo.kind === 'percentage'
              ? Math.floor((subtotal * promo.value) / 100)
              : promo.value,
          );
        }
        if (selectedPackage) {
          selectedPackage.stockRemaining -= quantity;
          await manager
            .getRepository(PortalCouponPackage)
            .save(selectedPackage);
          await refreshCouponSummary(manager, coupon!);
        }
        if (ticket) {
          ticket.stockRemaining -= quantity;
          await manager.getRepository(PortalEventTicket).save(ticket);
        }
        const items: PurchaseItemSnapshot[] = [];
        const snapshot: PurchaseSnapshot = {
          version: 2,
          input,
          resources: Object.fromEntries(
            resources.map((resource) => [resource.key, quantity]),
          ),
          promo: promo
            ? {
                kind: promo.kind,
                value: promo.value,
                maximumDiscount: promo.maximumDiscount,
                minimumOrder: promo.minimumOrder,
              }
            : null,
          unitPrice,
          subtotal,
          discount,
          total: subtotal - discount,
          items,
        };
        const order = await orders.save(
          orders.create({
            userId,
            idempotencyKey,
            requestFingerprint: fingerprint,
            quantity,
            orderNumber: `ORD-${randomUUID().slice(0, 8).toUpperCase()}`,
            status: 'Pending',
            kind: input.kind,
            total: snapshot.total,
            subtotal,
            discount,
            promoCode: promo?.code ?? null,
            paymentMethod: null,
            paymentState: 'Pending',
            paymentExpiresAt,
            virtualAccount: null,
            paidAt: null,
            cashbackAmount: 0,
            currency: 'IDR',
            title,
            purchaseSnapshot: snapshot,
            reservationReleasedAt: null,
            meta: `${input.attendee} · ${input.email} · ${input.phone}`,
          }),
        );
        if (promo?.campaignId) {
          promo.reservedOrderId = order.id;
          await manager.getRepository(PortalPromoCode).save(promo);
        }
        if (bundle) {
          const root = await manager.getRepository(PortalOrderItem).save(
            manager.getRepository(PortalOrderItem).create({
              orderId: order.id,
              productType: 'bundle',
              productId: bundle.id,
              title,
              quantity,
              unitPrice,
              benefitSnapshot: {
                role: 'price',
                couponId: coupon?.id,
                eventId: event?.id,
              },
            }),
          );
          items.push({
            id: root.id,
            title,
            productType: 'bundle',
            quantity,
            unitPrice,
          });
        }
        for (let unit = 0; unit < quantity; unit++) {
          const unitDiscount =
            Math.floor(discount / quantity) +
            (unit < discount % quantity ? 1 : 0);
          const allocatedSubtotal = splitValue(
            unitPrice,
            selectedPackage?.price ?? 0,
            ticket?.price ?? 0,
          );
          const allocatedDiscount = splitValue(
            unitDiscount,
            selectedPackage?.price ?? 0,
            ticket?.price ?? 0,
          );
          for (const kind of ['coupon', 'ticket'] as const) {
            if (kind === 'coupon' ? !coupon : !ticket) continue;
            const benefitSnapshot: BenefitSnapshot = {
              role: 'benefit',
              bundleId: bundle?.id ?? null,
              unitIndex: unit,
              allocation: bundle
                ? {
                    subtotal: allocatedSubtotal[kind],
                    discount: allocatedDiscount[kind],
                    total: allocatedSubtotal[kind] - allocatedDiscount[kind],
                  }
                : {
                    subtotal: unitPrice,
                    discount: unitDiscount,
                    total: unitPrice - unitDiscount,
                  },
              couponId: coupon?.id ?? null,
              eventId: event?.id ?? null,
              ticketTypeId: ticket?.id ?? null,
              attendee: input.attendees[unit] ?? input.attendee,
              imageUrl: kind === 'coupon' ? coupon!.imageUrl : event!.imageUrl,
              expiresAt: coupon?.expiresAt?.toISOString() ?? null,
              validityDays: coupon?.validityDays ?? null,
              salesEndsAt:
                (coupon?.salesEndsAt ?? coupon?.expiresAt)?.toISOString() ??
                null,
              eventStartsAt: event?.startsAt?.toISOString() ?? null,
              ticketSalesEndsAt: ticket?.salesEndsAt?.toISOString() ?? null,
              timeZone: coupon?.timeZone ?? event?.timeZone,
            };
            const item = await manager.getRepository(PortalOrderItem).save(
              manager.getRepository(PortalOrderItem).create({
                orderId: order.id,
                productType: kind,
                productId: kind === 'coupon' ? coupon!.id : ticket!.id,
                packageId: kind === 'coupon' ? selectedPackage!.id : null,
                packageSnapshot:
                  kind === 'coupon' ? packageSnapshot(selectedPackage!) : null,
                title: kind === 'coupon' ? coupon!.title : event!.title,
                quantity: 1,
                unitPrice: bundle ? 0 : unitPrice,
                unitIndex: unit,
                benefitSnapshot,
              }),
            );
            items.push({
              id: item.id,
              title: item.title,
              productType: kind,
              quantity: 1,
              unitPrice: item.unitPrice,
              unitIndex: unit,
              attendee: benefitSnapshot.attendee,
              allocation: benefitSnapshot.allocation,
            });
            if (kind === 'ticket')
              await manager.getRepository(PortalTicket).save(
                manager.getRepository(PortalTicket).create({
                  userId,
                  eventId: event!.id,
                  ticketTypeId: ticket!.id,
                  code: `TKT-${randomUUID().slice(0, 8).toUpperCase()}`,
                  attendee: benefitSnapshot.attendee,
                  status: PASS_STATUS.Reserved,
                  orderItemId: item.id,
                  imageUrl: event!.imageUrl,
                  checkedInAt: null,
                }),
              );
          }
        }
        order.purchaseSnapshot = snapshot;
        await orders.save(order);
        return this.serializeOrder(order, manager);
      }),
    );
  }

  async payOrder(
    userId: number,
    idOrNumber: string,
    dto: PayPortalOrderDto,
    confirmation?: { source: 'sandbox' | 'webhook'; reference?: string },
  ) {
    return observeCampaign('payOrder', () =>
      this.dataSource.transaction(async (manager) => {
        await this.campaigns.lockCommerce(manager, userId);
        const orders = manager.getRepository(PortalOrder);
        const numericId = parseDatabaseId(idOrNumber);
        const order = await orders
          .createQueryBuilder('order')
          .setLock('pessimistic_write')
          .where('order.userId = :userId', { userId })
          .andWhere(
            numericId !== undefined
              ? '(order.id = :id OR order.orderNumber = :orderNumber)'
              : 'order.orderNumber = :orderNumber',
            { id: numericId, orderNumber: idOrNumber },
          )
          .getOne();
        if (!order) throw new NotFoundException('Order not found');
        if (confirmation?.source === 'sandbox') {
          assertPaymentSandbox();
          if (order.paymentMethod !== 'va' || !order.virtualAccount?.sandbox)
            throw new ConflictException('No sandbox VA has been created');
        }
        if (order.status === 'Paid' || order.status === 'Refunded') {
          if (
            order.paymentMethod !== dto.paymentMethod ||
            (confirmation?.reference &&
              order.paymentReference &&
              confirmation.reference !== order.paymentReference)
          )
            throw new ConflictException(
              'Payment retry conflicts with settled payment',
            );
          return this.serializeOrder(order, manager);
        }
        const now = await this.commerceNow(manager);
        if (order.paymentState === 'LateSettled') {
          if (
            confirmation?.reference &&
            order.paymentReference &&
            confirmation.reference !== order.paymentReference
          )
            throw new ConflictException(
              'Payment retry conflicts with late payment',
            );
          return this.serializeOrder(order, manager);
        }
        if (
          confirmation &&
          dto.paymentMethod === 'va' &&
          (order.status !== 'Pending' ||
            paymentExpired(order.paymentExpiresAt, now))
        ) {
          if (order.status === 'Pending') {
            await this.releaseOrderReservation(manager, order);
            order.status = 'Expired';
          }
          order.paymentState = 'LateSettled';
          order.paymentReference =
            confirmation.reference ?? order.paymentReference;
          order.refundStatus = 'Processing';
          order.refundReason = 'Late VA payment';
          await orders.save(order);
          await this.queueCommerceEvent(
            manager,
            `late:${order.id}`,
            'audit.record',
            {
              action: 'portal.late_payment',
              actorId: null,
              subjectType: 'PortalOrder',
              subjectId: String(order.id),
              summary: 'Late payment awaiting refund',
              metadata: { orderNumber: order.orderNumber },
            },
          );
          return this.serializeOrder(order, manager);
        }
        if (order.status !== 'Pending')
          throw new ConflictException('Order cannot be paid');
        if (paymentExpired(order.paymentExpiresAt, now))
          throw new ConflictException('Payment deadline has expired');
        if (dto.paymentMethod === 'va' && !confirmation) {
          assertPaymentSandbox();
          if (!order.virtualAccount) {
            order.paymentExpiresAt ??= new Date(Date.now() + PAYMENT_TTL_MS);
            order.paymentMethod = 'va';
            order.paymentReference = `SANDBOX-${order.orderNumber}`;
            order.virtualAccount = {
              bank: 'Bank Sandbox',
              number: `8800${String(order.id).padStart(12, '0')}`,
              sandbox: true,
            };
            await orders.save(order);
          }
          return this.serializeOrder(order, manager);
        }
        // New orders settle from immutable snapshots and their locked deadline.
        if (!order.purchaseSnapshot) {
          const legacyItem = await manager
            .getRepository(PortalOrderItem)
            .findOneBy({ orderId: order.id });
          if (legacyItem?.productType === 'coupon') {
            const coupon = await manager
              .getRepository(PortalCoupon)
              .findOneBy({ id: legacyItem.productId });
            if (!coupon || coupon.expiresAt <= now)
              throw new ConflictException('Coupon has expired');
          }
        }

        if (order.promoCode) {
          const promo = await manager.getRepository(PortalPromoCode).findOne({
            where: { code: order.promoCode },
            lock: { mode: 'pessimistic_write' },
          });
          if (promo && order.purchaseSnapshot) {
            promo.usageCount += 1;
            await manager.getRepository(PortalPromoCode).save(promo);
          }
          if (promo?.campaignId) {
            if (
              promo.ownerUserId !== userId ||
              promo.reservedOrderId !== order.id ||
              !promo.active ||
              promo.revokedAt ||
              promo.consumedAt ||
              promo.expiresAt <= new Date()
            )
              throw new ConflictException(
                'Reserved campaign reward is no longer valid; cancel this order',
              );
            promo.consumedAt = new Date();
            promo.reservedOrderId = null;
            await manager.getRepository(PortalPromoCode).save(promo);
          }
        }
        const wallets = manager.getRepository(PortalWallet);
        const wallet = await this.lockWallet(manager, userId);
        if (dto.paymentMethod === 'coins') {
          if (wallet.balance < order.total)
            throw new ConflictException('Saldo cashback tidak cukup');
          wallet.balance -= order.total;
        }

        const cashbackAmount = Math.min(50000, Math.floor(order.total * 0.05));
        wallet.balance += cashbackAmount;
        wallet.lifetimeEarned += cashbackAmount;
        await wallets.save(wallet);
        const transactions = manager.getRepository(PortalWalletTransaction);
        if (dto.paymentMethod === 'coins') {
          const description = `Payment ${order.orderNumber}`;
          if (!(await transactions.findOneBy({ description })))
            await transactions.save(
              transactions.create({
                userId,
                type: 'purchase',
                amount: -order.total,
                description,
              }),
            );
        }
        if (cashbackAmount > 0) {
          const description = `Cashback ${order.orderNumber}`;
          if (!(await transactions.findOneBy({ description })))
            await transactions.save(
              transactions.create({
                userId,
                type: 'cashback',
                amount: cashbackAmount,
                description,
              }),
            );
        }

        order.status = 'Paid';
        order.paymentState = 'Settled';
        order.paymentMethod = dto.paymentMethod;
        order.paymentReference =
          confirmation?.reference ?? order.paymentReference;
        if (dto.paymentMethod === 'coins') order.virtualAccount = null;
        order.paidAt = now;
        order.cashbackAmount = cashbackAmount;
        await orders.save(order);

        const items = await manager
          .getRepository(PortalOrderItem)
          .find({ where: { orderId: order.id }, order: { id: 'ASC' } });
        for (const item of items) {
          if (item.productType === 'coupon') {
            const coupon = await manager
              .getRepository(PortalCoupon)
              .findOneBy({ id: item.productId });
            if (!coupon)
              throw new ConflictException('Reserved coupon no longer exists');
            const snapshot = item.benefitSnapshot;
            if (
              coupon &&
              !(await manager
                .getRepository(PortalVoucher)
                .findOneBy({ orderItemId: item.id }))
            ) {
              const expiresAt = snapshot?.validityDays
                ? new Date(now.getTime() + snapshot.validityDays * 86400000)
                : new Date(snapshot?.expiresAt ?? coupon.expiresAt);
              await manager.getRepository(PortalVoucher).save(
                manager.getRepository(PortalVoucher).create({
                  userId,
                  couponId: coupon.id,
                  orderItemId: item.id,
                  packageId: item.packageId ?? null,
                  packageSnapshot: item.packageSnapshot ?? null,
                  code: `VCH-${randomUUID().slice(0, 8).toUpperCase()}`,
                  status: PASS_STATUS.Issued,
                  expiresAt,
                  timeZone: snapshot?.timeZone ?? coupon.timeZone,
                  redeemedAt: null,
                  imageUrl: snapshot?.imageUrl ?? coupon.imageUrl,
                }),
              );
            }
          }
          if (item.productType === 'ticket') {
            const passes = await manager.getRepository(PortalTicket).find({
              where: {
                orderItemId: item.id,
                userId,
                status: PASS_STATUS.Reserved,
              },
            });
            if (passes.length !== item.quantity)
              throw new ConflictException('Reserved tickets are incomplete');
            for (const pass of passes) {
              pass.status = PASS_STATUS.Issued;
              await manager.getRepository(PortalTicket).save(pass);
            }
          }
        }
        await this.campaigns.paid(manager, order);
        await this.queueCommerceEvent(
          manager,
          `payment:${order.id}`,
          'audit.record',
          {
            action: 'portal.order_paid',
            actorId: userId,
            subjectType: 'PortalOrder',
            subjectId: String(order.id),
            summary: 'Order settled',
            metadata: {
              orderNumber: order.orderNumber,
              quantity: order.quantity ?? 1,
              amount: order.total,
            },
          },
        );
        return this.serializeOrder(order, manager);
      }),
    );
  }

  async simulatePayment(userId: number, idOrNumber: string) {
    assertPaymentSandbox();
    return this.payOrder(
      userId,
      idOrNumber,
      { paymentMethod: 'va' },
      { source: 'sandbox' },
    );
  }

  async expirePendingOrders() {
    const due = await this.orderRepository.find({
      where: {
        status: 'Pending',
        paymentExpiresAt: LessThanOrEqual(new Date()),
      },
      order: { paymentExpiresAt: 'ASC' },
      take: 100,
    });
    for (const candidate of due) {
      await this.dataSource.transaction(async (manager) => {
        await this.campaigns.lockCommerce(manager, candidate.userId);
        const order = await this.findLockedOrder(
          manager,
          candidate.userId,
          candidate.orderNumber,
        );
        if (
          !order ||
          order.status !== 'Pending' ||
          !paymentExpired(
            order.paymentExpiresAt,
            await this.commerceNow(manager),
          )
        )
          return;
        await this.releaseOrderReservation(manager, order);
        order.status = 'Expired';
        await manager.getRepository(PortalOrder).save(order);
      });
    }
    return due.length;
  }

  async cancelOrder(userId: number, idOrNumber: string) {
    return observeCampaign('cancelOrder', () =>
      this.dataSource.transaction(async (manager) => {
        await this.campaigns.lockCommerce(manager, userId);
        const order = await this.findLockedOrder(manager, userId, idOrNumber);
        if (!order) throw new NotFoundException('Order not found');
        if (order.status === 'Cancelled')
          return this.serializeOrder(order, manager);
        if (order.status !== 'Pending')
          throw new ConflictException('Only pending orders can be cancelled');
        await this.releaseOrderReservation(manager, order);
        order.status = 'Cancelled';
        order.refundStatus = null;
        await manager.getRepository(PortalOrder).save(order);
        return this.serializeOrder(order, manager);
      }),
    );
  }

  async requestRefund(userId: number, idOrNumber: string, reason: string) {
    return observeCampaign('requestRefund', () =>
      this.dataSource.transaction(async (manager) => {
        await this.campaigns.lockCommerce(manager, userId);
        const order = await this.findLockedOrder(manager, userId, idOrNumber);
        if (!order) throw new NotFoundException('Order not found');
        if (REFUND_REQUEST_ACTIVE_STATUSES.includes(order.refundStatus ?? ''))
          return this.serializeOrder(order, manager);
        if (!canRequestOrderRefund(order))
          throw new ConflictException('Order cannot request a refund');

        if (!reason.trim())
          throw new BadRequestException('Refund reason is required');
        await this.assertRefundable(manager, order);
        await this.setRefundHold(manager, order, true);
        order.refundStatus = 'Requested';
        order.refundReason = reason.trim();
        order.refundRequestedAt = new Date();
        await manager.getRepository(PortalOrder).save(order);
        return this.serializeOrder(order, manager);
      }),
    );
  }

  async handlePaymentWebhook(
    secret: string | undefined,
    dto: PortalPaymentWebhookDto,
  ) {
    const expected = portalRuntimeConfig().paymentWebhookSecret;
    if (!expected || secret !== expected)
      throw new ForbiddenException('Invalid payment webhook secret');
    const order = await this.orderRepository.findOneBy({
      orderNumber: dto.orderNumber,
    });
    if (!order) throw new NotFoundException('Order not found');
    if (dto.status === 'refund_failed') {
      return this.dataSource.transaction(async (manager) => {
        await this.campaigns.lockCommerce(manager, order.userId);
        const locked = await this.findLockedOrder(
          manager,
          order.userId,
          order.orderNumber,
        );
        if (!locked || locked.refundStatus !== 'Processing')
          throw new ConflictException('Refund is not processing');
        locked.refundStatus = 'Failed';
        await manager.getRepository(PortalOrder).save(locked);
        return this.serializeOrder(locked, manager);
      });
    }
    if (dto.status === 'refunded') {
      return this.refundOrderFromWebhook(
        order.userId,
        order.orderNumber,
        dto.paymentReference,
      );
    }
    if (dto.status === 'failed') {
      return this.dataSource.transaction(async (manager) => {
        await this.campaigns.lockCommerce(manager, order.userId);
        const locked = await this.findLockedOrder(
          manager,
          order.userId,
          order.orderNumber,
        );
        if (!locked) throw new NotFoundException('Order not found');
        if (locked.status === 'Pending') {
          await this.releaseOrderReservation(manager, locked);
          locked.status = 'Failed';
          locked.paymentReference = dto.paymentReference ?? null;
          await manager.getRepository(PortalOrder).save(locked);
        }
        return this.serializeOrder(locked, manager);
      });
    }
    return this.payOrder(
      order.userId,
      order.orderNumber,
      {
        paymentMethod: dto.paymentMethod ?? 'va',
      },
      { source: 'webhook', reference: dto.paymentReference },
    );
  }

  async approveRefund(id: number, actorId: number) {
    const order = await this.orderRepository.findOneBy({ id });
    if (!order) throw new NotFoundException('Order not found');
    if (order.paymentMethod === 'va' && !order.virtualAccount?.sandbox) {
      return this.dataSource.transaction(async (manager) => {
        await this.campaigns.lockCommerce(manager, order.userId);
        const locked = await this.findLockedOrder(
          manager,
          order.userId,
          order.orderNumber,
        );
        if (
          !locked ||
          !['Requested', 'Failed', 'Processing'].includes(
            locked.refundStatus ?? '',
          )
        )
          throw new ConflictException('A refund request is required');
        if (locked.paymentState !== 'LateSettled')
          await this.assertRefundable(manager, locked);
        await this.setRefundHold(manager, locked, true);
        locked.refundStatus = 'Processing';
        await manager.getRepository(PortalOrder).save(locked);
        await this.queueCommerceEvent(
          manager,
          `refund-processing:${locked.id}`,
          'audit.record',
          {
            action: 'portal.refund_processing',
            actorId,
            subjectType: 'PortalOrder',
            subjectId: String(id),
            summary: 'External refund awaiting confirmation',
            metadata: {},
          },
        );
        return this.serializeOrder(locked, manager);
      });
    }
    return this.refundOrderFromWebhook(
      order.userId,
      order.orderNumber,
      undefined,
      actorId,
    );
  }

  async rejectRefund(id: number, actorId: number, reason: string) {
    if (!reason.trim())
      throw new BadRequestException('Rejection reason is required');
    return this.dataSource.transaction(async (manager) => {
      const snapshot = await manager
        .getRepository(PortalOrder)
        .findOneBy({ id });
      if (!snapshot) throw new NotFoundException('Order not found');
      await this.campaigns.lockCommerce(manager, snapshot.userId);
      const order = await this.findLockedOrder(
        manager,
        snapshot.userId,
        snapshot.orderNumber,
      );
      if (!order || order.refundStatus !== 'Requested')
        throw new ConflictException('Only requested refunds can be rejected');
      await this.setRefundHold(manager, order, false);
      order.refundStatus = 'Rejected';
      order.refundReason = reason.trim();
      await manager.getRepository(PortalOrder).save(order);
      await this.queueCommerceEvent(
        manager,
        `reject:${order.id}:${order.refundRequestedAt?.getTime()}`,
        'audit.record',
        {
          action: 'portal.refund_rejected',
          actorId,
          subjectType: 'PortalOrder',
          subjectId: String(id),
          summary: 'Refund rejected',
          metadata: { reason: reason.trim() },
        },
      );
      return this.serializeOrder(order, manager);
    });
  }

  async deliverCommerceEvents() {
    await deliverCommerceEvents(this.dataSource, this.events);
  }

  async listOrders(userId: number, query: OrderQueryDto = new OrderQueryDto()) {
    const { page, limit, filter } = query;
    let where: FindOptionsWhere<PortalOrder> | FindOptionsWhere<PortalOrder>[] =
      { userId };
    if (filter === 'Refunded') {
      where = [
        { userId, status: 'Refunded' },
        { userId, refundStatus: 'Refunded' },
      ];
    } else if (filter !== 'all') {
      where = {
        userId,
        status: filter,
        refundStatus: Raw(
          (alias) => `COALESCE(${alias}, '') <> :settledRefund`,
          { settledRefund: 'Refunded' },
        ),
      };
    }
    const [orders, total] = await this.orderRepository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: await this.serializeOrders(orders, this.dataSource.manager),
      meta: pageMeta(total, page, limit),
    };
  }

  async getOrder(userId: number, idOrNumber: string) {
    const numericId = parseDatabaseId(idOrNumber);
    const order = await this.orderRepository.findOne({
      where:
        numericId === undefined
          ? { orderNumber: idOrNumber, userId }
          : [
              { id: numericId, userId },
              { orderNumber: idOrNumber, userId },
            ],
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.serializeOrder(order);
  }

  paymentMethods(): { methods: Array<'va' | 'coins'> } {
    return { methods: paymentSandboxEnabled() ? ['va', 'coins'] : ['coins'] };
  }

  private async usedPurchaseQuantity(
    manager: EntityManager,
    userId: number,
    resourceKey: string,
    now: Date,
  ) {
    const [kind, rawId] = resourceKey.split(':');
    const resourceId = Number(rawId);
    const schema = String(
      (manager.connection.options as { schema?: string }).schema ?? 'public',
    ).replaceAll('"', '""');
    const table = (name: string) => `"${schema}"."${name}"`;
    const [snapshot] = await manager.query<
      Array<{
        used?: string | number | null;
      }>
    >(
      `WITH live_orders AS (
        SELECT "id", "purchaseSnapshot" FROM ${table('portal_orders')}
        WHERE "userId" = $1 AND (
          ("status" = 'Paid' AND COALESCE("refundStatus", '') <> 'Refunded') OR
          ("status" = 'Pending' AND ("paymentExpiresAt" IS NULL OR "paymentExpiresAt" > $3))
        )
      )
      SELECT COALESCE(SUM(NULLIF("purchaseSnapshot"->'resources'->>$2, '')::int), 0) AS used
      FROM live_orders
      WHERE "purchaseSnapshot" IS NOT NULL AND "purchaseSnapshot" ? 'resources'`,
      [userId, resourceKey, now],
    );
    const [legacy] = await manager.query<
      Array<{
        used?: string | number | null;
      }>
    >(
      `WITH live_orders AS (
        SELECT "id", "purchaseSnapshot" FROM ${table('portal_orders')}
        WHERE "userId" = $1 AND (
          ("status" = 'Paid' AND COALESCE("refundStatus", '') <> 'Refunded') OR
          ("status" = 'Pending' AND ("paymentExpiresAt" IS NULL OR "paymentExpiresAt" > $3))
        )
      )
      SELECT COALESCE(SUM(i."quantity"), 0) AS used
      FROM live_orders o
      JOIN ${table('portal_order_items')} i ON i."orderId" = o."id"
      LEFT JOIN ${table('portal_bundles')} b ON i."productType" = 'bundle' AND b."id" = i."productId"
      LEFT JOIN ${table('portal_coupons')} c ON c."id" = $4 AND $2 = 'coupon'
      LEFT JOIN ${table('portal_events')} e ON e."id" = $4 AND $2 = 'event'
      LEFT JOIN ${table('portal_event_tickets')} t ON i."productType" = 'ticket' AND t."id" = i."productId"
      WHERE (o."purchaseSnapshot" IS NULL OR NOT (o."purchaseSnapshot" ? 'resources'))
        AND (
          ($2 = 'coupon' AND ((i."productType" = 'coupon' AND i."productId" = $4) OR
            (i."productType" = 'bundle' AND b."couponSlug" = c."slug"))) OR
          ($2 = 'bundle' AND i."productType" = 'bundle' AND i."productId" = $4) OR
          ($2 = 'event' AND ((i."productType" = 'ticket' AND t."eventId" = $4) OR
            (i."productType" = 'bundle' AND b."eventSlug" = e."slug")))
        )`,
      [userId, kind, now, resourceId],
    );
    return Number(snapshot?.used ?? 0) + Number(legacy?.used ?? 0);
  }

  private async commerceNow(manager: EntityManager) {
    const rows = await manager.query<Array<{ now: Date | string }>>(
      'SELECT clock_timestamp() AS now',
    );
    return rows[0]?.now ? new Date(rows[0].now) : new Date();
  }

  private async assertRefundable(manager: EntityManager, order: PortalOrder) {
    const items = await manager
      .getRepository(PortalOrderItem)
      .find({ where: { orderId: order.id }, order: { id: 'ASC' } });
    for (const item of items)
      for (const entity of [PortalVoucher, PortalTicket]) {
        const passes = await manager.getRepository(entity).find({
          where: { orderItemId: item.id },
          order: { id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        if (hasUsedBenefit(passes.map((pass) => pass.status)))
          throw new ConflictException('Used passes cannot be refunded');
      }
  }

  private async setRefundHold(
    manager: EntityManager,
    order: PortalOrder,
    hold: boolean,
  ) {
    const items = await manager
      .getRepository(PortalOrderItem)
      .find({ where: { orderId: order.id }, order: { id: 'ASC' } });
    for (const item of items)
      for (const entity of [PortalVoucher, PortalTicket])
        await manager.getRepository(entity).update(
          {
            orderItemId: item.id,
            status: hold ? PASS_STATUS.Issued : 'RefundPending',
          },
          { status: hold ? 'RefundPending' : PASS_STATUS.Issued },
        );
  }

  private async refundOrderFromWebhook(
    userId: number,
    orderNumber: string,
    paymentReference?: string,
    actorId?: number,
  ) {
    const result = await observeCampaign('refundOrderFromWebhook', () =>
      this.dataSource.transaction(async (manager) => {
        await this.campaigns.lockCommerce(manager, userId);
        const order = await this.findLockedOrder(manager, userId, orderNumber);
        if (!order) throw new NotFoundException('Order not found');
        if (order.status === 'Refunded' || order.refundStatus === 'Refunded')
          return { order, changed: false };
        if (order.paymentState === 'LateSettled') {
          if (actorId !== undefined) {
            assertPaymentSandbox();
            if (!order.virtualAccount?.sandbox)
              throw new ConflictException(
                'External refunds require provider confirmation',
              );
          }
          order.refundStatus = 'Refunded';
          order.refundedAt = await this.commerceNow(manager);
          await manager.getRepository(PortalOrder).save(order);
          await this.queueCommerceEvent(
            manager,
            `refund-audit:${order.id}`,
            'audit.record',
            {
              action:
                actorId === undefined
                  ? 'portal.order_refunded'
                  : 'portal.refund_approved',
              actorId: actorId ?? null,
              subjectType: 'PortalOrder',
              subjectId: String(order.id),
              summary: 'Order refund completed',
              metadata: {
                orderNumber,
                paymentMethod: order.paymentMethod,
                amount: order.total,
                sandbox: order.virtualAccount?.sandbox ?? false,
              },
            },
          );
          await this.queueCommerceEvent(
            manager,
            `refund-notify:${order.id}`,
            'user.notification',
            {
              userId,
              title: 'Refund selesai',
              message: `Refund pesanan ${orderNumber} sudah selesai.`,
              link: `/orders/${orderNumber}`,
            },
          );
          return { order, changed: true };
        }
        if (order.status !== 'Paid')
          throw new ConflictException('Only paid orders can be refunded');
        if (
          actorId !== undefined &&
          !['Requested', 'Failed'].includes(order.refundStatus ?? '')
        )
          throw new ConflictException('A refund request is required');
        if (actorId !== undefined && order.paymentMethod === 'va') {
          assertPaymentSandbox();
          if (!order.virtualAccount?.sandbox)
            throw new ConflictException(
              'External VA refunds require provider confirmation',
            );
        }
        await this.assertRefundable(manager, order);
        await this.releaseOrderReservation(manager, order);
        const items = await manager
          .getRepository(PortalOrderItem)
          .find({ where: { orderId: order.id } });
        for (const item of items) {
          for (const entity of [PortalVoucher, PortalTicket]) {
            await manager
              .getRepository(entity)
              .update(
                { orderItemId: item.id },
                { status: PASS_STATUS.Cancelled },
              );
          }
        }
        const wallets = manager.getRepository(PortalWallet);
        const wallet = await this.lockWallet(manager, userId);
        const transactions = manager.getRepository(PortalWalletTransaction);
        if (order.paymentMethod === 'coins') {
          wallet.balance += order.total;
          await transactions.save(
            transactions.create({
              userId,
              type: 'refund',
              amount: order.total,
              description: `Refund payment ${order.orderNumber}`,
            }),
          );
        }
        // The whole cashback comes back even if it was already spent, so a
        // refund can't keep it; the balance may go negative and later
        // cashback pays it off (coin checkout needs balance >= total).
        const reversedCashback = order.cashbackAmount;
        wallet.balance -= reversedCashback;
        wallet.lifetimeEarned = Math.max(
          0,
          wallet.lifetimeEarned - order.cashbackAmount,
        );
        if (reversedCashback > 0)
          await transactions.save(
            transactions.create({
              userId,
              type: 'refund',
              amount: -reversedCashback,
              description: `Refund cashback ${order.orderNumber}`,
            }),
          );
        await wallets.save(wallet);
        await this.campaigns.refund(manager, order);
        order.status = 'Refunded';
        order.refundStatus = 'Refunded';
        order.refundedAt = new Date();
        order.paymentReference = paymentReference ?? order.paymentReference;
        await manager.getRepository(PortalOrder).save(order);
        await this.queueCommerceEvent(
          manager,
          `refund-audit:${order.id}`,
          'audit.record',
          {
            action:
              actorId === undefined
                ? 'portal.order_refunded'
                : 'portal.refund_approved',
            actorId: actorId ?? null,
            subjectType: 'PortalOrder',
            subjectId: String(order.id),
            summary: 'Order refund completed',
            metadata: {
              orderNumber,
              paymentMethod: order.paymentMethod,
              amount: order.total,
              sandbox: order.virtualAccount?.sandbox ?? false,
            },
          },
        );
        await this.queueCommerceEvent(
          manager,
          `refund-notify:${order.id}`,
          'user.notification',
          {
            userId,
            title: 'Refund selesai',
            message: `Refund pesanan ${orderNumber} sudah selesai.`,
            link: `/orders/${orderNumber}`,
          },
        );
        return { order, changed: true };
      }),
    );
    if (result.changed) await this.deliverCommerceEvents();
    return this.serializeOrder(result.order);
  }

  private queueCommerceEvent(
    manager: EntityManager,
    operationKey: string,
    eventName: string,
    payload: Record<string, unknown>,
  ) {
    return enqueueCommerceEvent(manager, operationKey, eventName, payload);
  }

  private async findLockedOrder(
    manager: import('typeorm').EntityManager,
    userId: number,
    idOrNumber: string,
  ) {
    const numericId = parseDatabaseId(idOrNumber);
    return manager
      .getRepository(PortalOrder)
      .createQueryBuilder('order')
      .setLock('pessimistic_write')
      .where('order.userId = :userId', { userId })
      .andWhere(
        numericId !== undefined
          ? '(order.id = :id OR order.orderNumber = :orderNumber)'
          : 'order.orderNumber = :orderNumber',
        { id: numericId, orderNumber: idOrNumber },
      )
      .getOne();
  }

  private async releaseOrderReservation(
    manager: EntityManager,
    order: PortalOrder,
  ) {
    if (order.reservationReleasedAt) return;
    const now = await this.commerceNow(manager);
    const items = await manager
      .getRepository(PortalOrderItem)
      .find({ where: { orderId: order.id } });
    items.sort(
      (a, b) =>
        a.productType.localeCompare(b.productType) ||
        a.productId - b.productId ||
        a.id - b.id,
    );
    for (const item of items) {
      if (item.productType === 'coupon') {
        const coupon = await manager.getRepository(PortalCoupon).findOne({
          where: { id: item.productId },
          withDeleted: true,
          loadEagerRelations: false,
          lock: { mode: 'pessimistic_write' },
        });
        const sellable =
          coupon &&
          coupon.active &&
          !coupon.deletedAt &&
          (coupon.salesEndsAt ?? coupon.expiresAt) > now &&
          (coupon.validityDays || coupon.expiresAt > now);
        if (coupon && item.packageId) {
          const selected = await manager
            .getRepository(PortalCouponPackage)
            .findOne({
              where: { id: item.packageId, couponId: coupon.id },
              withDeleted: true,
              lock: { mode: 'pessimistic_write' },
            });
          if (!selected)
            throw new ConflictException('Reserved coupon package is missing');
          if (sellable && selected.active && !selected.deletedAt) {
            selected.stockRemaining = Math.min(
              selected.stockTotal,
              selected.stockRemaining + item.quantity,
            );
            await manager.getRepository(PortalCouponPackage).save(selected);
            await refreshCouponSummary(manager, coupon);
          }
        } else if (coupon && sellable) {
          coupon.stockRemaining = Math.min(
            coupon.stockTotal,
            coupon.stockRemaining + item.quantity,
          );
          await manager.getRepository(PortalCoupon).save(coupon);
        }
      }
      if (item.productType === 'ticket') {
        const ticketType = await lockEventTicket(manager, {
          id: item.productId,
        });
        if (ticketType) {
          const event = await manager
            .getRepository(PortalEvent)
            .findOneBy({ id: ticketType.eventId });
          const sellable =
            event?.active &&
            !event.deletedAt &&
            (!event.startsAt || event.startsAt > now) &&
            (!ticketType.salesEndsAt || ticketType.salesEndsAt > now);
          if (sellable) {
            ticketType.stockRemaining = Math.min(
              ticketType.stockTotal,
              ticketType.stockRemaining + item.quantity,
            );
            await manager.getRepository(PortalEventTicket).save(ticketType);
          }
        }
        await manager.getRepository(PortalTicket).update(
          {
            orderItemId: item.id,
            userId: order.userId,
            status: PASS_STATUS.Reserved,
          },
          { status: PASS_STATUS.Cancelled },
        );
      }
    }
    if (order.promoCode) {
      const promo = await manager.getRepository(PortalPromoCode).findOne({
        where: { code: order.promoCode },
        lock: { mode: 'pessimistic_write' },
      });
      if (promo) {
        if (!order.purchaseSnapshot || order.status === 'Paid')
          promo.usageCount = Math.max(0, promo.usageCount - 1);
        if (promo.campaignId && promo.reservedOrderId === order.id)
          promo.reservedOrderId = null;
        await manager.getRepository(PortalPromoCode).save(promo);
      }
    }
    order.reservationReleasedAt = now;
    await manager.getRepository(PortalOrder).save(order);
  }

  private async serializeOrders(orders: PortalOrder[], manager: EntityManager) {
    if (!orders.length) return [];
    const eligible = new Set(
      orders
        .filter((order) => canRequestOrderRefund(order))
        .map((order) => order.id),
    );
    const itemOrderIds = orders
      .filter(
        (order) =>
          eligible.has(order.id) || !order.purchaseSnapshot?.items?.length,
      )
      .map((order) => order.id);
    const storedItems = itemOrderIds.length
      ? await manager.getRepository(PortalOrderItem).find({
          where: { orderId: In(itemOrderIds) },
          order: { id: 'ASC' },
        })
      : [];
    const itemsByOrder = new Map<number, PortalOrderItem[]>();
    for (const item of storedItems) {
      const group = itemsByOrder.get(item.orderId) ?? [];
      group.push(item);
      itemsByOrder.set(item.orderId, group);
    }
    const refundableItemIds = storedItems
      .filter((item) => eligible.has(item.orderId))
      .map((item) => item.id);
    const usedPasses = refundableItemIds.length
      ? await Promise.all(
          [PortalVoucher, PortalTicket].map((entity) =>
            manager.getRepository(entity).find({
              select: { orderItemId: true },
              where: {
                orderItemId: In(refundableItemIds),
                status: In(USED_BENEFIT_STATUSES),
              },
            }),
          ),
        )
      : [];
    const usedItemIds = new Set(
      usedPasses.flat().map((pass) => pass.orderItemId),
    );
    const usedOrders = new Set(
      storedItems
        .filter((item) => usedItemIds.has(item.id))
        .map((item) => item.orderId),
    );
    return orders.map((order) => {
      const items = order.purchaseSnapshot?.items?.length
        ? order.purchaseSnapshot.items
        : (itemsByOrder.get(order.id) ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            productType: item.productType,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitIndex: item.unitIndex,
            attendee: item.benefitSnapshot?.attendee,
          }));
      return this.serializeOrderView(
        order,
        items,
        canRequestOrderRefund(order, usedOrders.has(order.id)),
      );
    });
  }

  private async serializeOrder(
    order: PortalOrder,
    manager = this.dataSource.manager,
  ) {
    return (await this.serializeOrders([order], manager))[0];
  }

  private serializeOrderView(
    order: PortalOrder,
    items: Array<{
      id: number;
      title: string;
      productType: OrderItemProductType;
      quantity: number;
      unitPrice: number;
      unitIndex?: number | null;
      attendee?: string;
    }>,
    canRequestRefund: boolean,
  ) {
    return {
      id: order.orderNumber,
      publicId: order.publicId,
      title: order.title,
      meta: order.meta,
      total: order.total,
      subtotal: order.subtotal || order.total,
      discount: order.discount,
      promoCode: order.promoCode,
      quantity: order.quantity ?? 1,
      paymentState: order.paymentState ?? null,
      canRequestRefund,
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        productType: item.productType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitIndex: item.unitIndex,
        attendee: item.attendee,
      })),
      attendees: order.purchaseSnapshot?.input?.attendees ?? [],
      paymentMethod: order.paymentMethod,
      paidAt: order.paidAt,
      cashbackAmount: order.cashbackAmount,
      paymentReference: order.paymentReference,
      paymentExpiresAt: order.paymentExpiresAt ?? null,
      virtualAccount: order.virtualAccount ?? null,
      canSimulatePayment:
        paymentSandboxEnabled() &&
        Boolean(order.virtualAccount?.sandbox) &&
        (order.status === 'Pending' || order.paymentState === 'LateSettled'),
      refundStatus: order.refundStatus,
      refundReason: order.refundReason,
      refundRequestedAt: order.refundRequestedAt,
      refundedAt: order.refundedAt,
      status: order.status,
      kind: order.kind,
    };
  }
  private async lockWallet(manager: EntityManager, userId: number) {
    const wallets = manager.getRepository(PortalWallet);
    await wallets
      .createQueryBuilder()
      .insert()
      .values({ userId, balance: 0, lifetimeEarned: 0 })
      .orIgnore()
      .execute();
    return wallets.findOneOrFail({
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
  }
}
