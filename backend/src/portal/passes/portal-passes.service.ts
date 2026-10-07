import { ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import {
  assertPackageAvailable,
  lockCouponPackage,
  packageSnapshot,
  refreshCouponSummary,
} from '@/portal/catalog/coupon-packages';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import { PortalOrderItem } from '@/portal/commerce/entities/portal-order-item.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { parseDatabaseId } from '@/common/utils/database-id';
import { PASS_STATUS, ticketDisplayStatus } from '@/portal/passes/pass-status';
import { Injectable } from '@nestjs/common';
import { serializeVoucher } from '@/portal/passes/voucher.serializer';

@Injectable()
export class PortalPassesService {
  constructor(
    @InjectRepository(PortalCoupon)
    private readonly couponRepository: Repository<PortalCoupon>,
    @InjectRepository(PortalEvent)
    private readonly eventRepository: Repository<PortalEvent>,
    @InjectRepository(PortalVoucher)
    private readonly voucherRepository: Repository<PortalVoucher>,
    @InjectRepository(PortalTicket)
    private readonly ticketRepository: Repository<PortalTicket>,
    @InjectRepository(PortalOrderItem)
    private readonly orderItemRepository: Repository<PortalOrderItem>,
    private readonly dataSource: DataSource,
  ) {}
  async claimCoupon(userId: number, slug: string, packagePublicId?: string) {
    return this.dataSource.transaction(async (manager) => {
      const coupons = manager.getRepository(PortalCoupon);
      const vouchers = manager.getRepository(PortalVoucher);
      const coupon = await coupons
        .createQueryBuilder('coupon')
        .setLock('pessimistic_write')
        .where('coupon.slug = :slug AND coupon.active = true', { slug })
        .getOne();

      if (!coupon) throw new NotFoundException('Coupon not found');
      const selected = await lockCouponPackage(
        manager,
        coupon.id,
        packagePublicId,
      );
      if (selected.price > 0)
        throw new ConflictException('Paid coupon packages require checkout');
      const existing = await vouchers.findOneBy({
        userId,
        couponId: coupon.id,
        packageId: selected.id,
      });
      if (existing)
        return serializeVoucher(
          existing,
          coupon,
          await this.passOrderId(userId, existing.orderItemId),
        );
      assertPackageAvailable(selected);
      if (
        (coupon.salesEndsAt ?? coupon.expiresAt) <= new Date() ||
        (!coupon.validityDays && coupon.expiresAt <= new Date())
      )
        throw new ConflictException('Coupon has expired');

      selected.stockRemaining -= 1;
      await manager.getRepository(PortalCouponPackage).save(selected);
      await refreshCouponSummary(manager, coupon);
      const voucher = await vouchers.save(
        vouchers.create({
          userId,
          couponId: coupon.id,
          packageId: selected.id,
          packageSnapshot: packageSnapshot(selected),
          code: `VCH-${randomUUID().slice(0, 8).toUpperCase()}`,
          status: PASS_STATUS.Issued,
          expiresAt: coupon.validityDays
            ? new Date(Date.now() + coupon.validityDays * 86400000)
            : coupon.expiresAt,
          timeZone: coupon.timeZone,
          redeemedAt: null,
          imageUrl: coupon.imageUrl,
        }),
      );
      return serializeVoucher(voucher, coupon);
    });
  }

  async listVouchers(userId: number) {
    const vouchers = await this.voucherRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const coupons = await this.couponRepository.findBy({
      id: In(vouchers.map((item) => item.couponId)),
    });
    const byId = new Map(coupons.map((item) => [item.id, item]));
    const orderIds = await this.passOrderIds(
      userId,
      vouchers.map((item) => item.orderItemId),
    );
    return vouchers.map((item) =>
      serializeVoucher(
        item,
        byId.get(item.couponId),
        orderIds.get(item.orderItemId ?? -1) ?? null,
      ),
    );
  }

  async getVoucher(userId: number, codeOrId: string) {
    const numericId = parseDatabaseId(codeOrId);
    const voucher = await this.voucherRepository.findOne({
      where:
        numericId === undefined
          ? { code: codeOrId, userId }
          : [
              { id: numericId, userId },
              { code: codeOrId, userId },
            ],
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    const coupon = await this.couponRepository.findOneBy({
      id: voucher.couponId,
    });
    return serializeVoucher(
      voucher,
      coupon ?? undefined,
      await this.passOrderId(userId, voucher.orderItemId),
    );
  }

  async listTickets(userId: number) {
    const tickets = await this.ticketRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const events = await this.eventRepository.findBy({
      id: In(tickets.map((item) => item.eventId)),
    });
    const byId = new Map(events.map((item) => [item.id, item]));
    const orderIds = await this.passOrderIds(
      userId,
      tickets.map((item) => item.orderItemId),
    );
    return tickets.map((item) => {
      const event = byId.get(item.eventId);
      return {
        id: item.code,
        publicId: item.publicId,
        orderId: orderIds.get(item.orderItemId ?? -1) ?? null,
        title: event?.title ?? 'Event',
        meta: event?.dateLabel ?? '',
        venue: event?.venue ?? '',
        attendee: item.attendee,
        targetKey: event?.slug ?? '',
        status: ticketDisplayStatus(item.status, event?.startsAt),
        image: item.imageUrl,
      };
    });
  }

  async getTicket(userId: number, code: string) {
    const ticket = await this.ticketRepository.findOneBy({ userId, code });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return (await this.listTickets(userId)).find((item) => item.id === code);
  }

  private async passOrderIds(
    userId: number,
    orderItemIds: Array<number | null>,
  ): Promise<Map<number, string>> {
    const ids = [
      ...new Set(orderItemIds.filter((id): id is number => id !== null)),
    ];
    if (!ids.length) return new Map();
    const rows = await this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin(PortalOrder, 'order', 'order.id = item.orderId')
      .select('item.id', 'itemId')
      .addSelect('order.orderNumber', 'orderNumber')
      .where('item.id IN (:...ids)', { ids })
      .andWhere('order.userId = :userId', { userId })
      .andWhere('order.deletedAt IS NULL')
      .getRawMany<{ itemId: number | string; orderNumber: string }>();
    return new Map(rows.map((row) => [Number(row.itemId), row.orderNumber]));
  }

  private async passOrderId(userId: number, orderItemId: number | null) {
    if (orderItemId === null) return null;
    return (
      (await this.passOrderIds(userId, [orderItemId])).get(orderItemId) ?? null
    );
  }
}
