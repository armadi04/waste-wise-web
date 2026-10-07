import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';

export const packageSnapshot = (item: PortalCouponPackage) => ({
  publicId: item.publicId,
  name: item.name,
  benefits: item.benefits,
  price: item.price,
});

// Callers lock the parent coupon first, so admin, claims and gifts share a lock order.
export async function lockCouponPackage(
  manager: EntityManager,
  couponId: number,
  publicId?: string,
) {
  const query = manager
    .getRepository(PortalCouponPackage)
    .createQueryBuilder('package')
    .setLock('pessimistic_write')
    .where('package.couponId = :couponId', { couponId });
  if (publicId) query.andWhere('package.publicId = :publicId', { publicId });
  else query.andWhere('package.isDefault = true');
  const item = await query.getOne();
  if (!item) throw new NotFoundException('Coupon package not found');
  return item;
}

export function assertPackageAvailable(item: PortalCouponPackage) {
  if (!item.active) throw new ConflictException('Coupon package is inactive');
  if (item.stockRemaining < 1)
    throw new ConflictException('Coupon package is sold out');
}

export function couponPackageSummary(items: PortalCouponPackage[]) {
  const active = items.filter((item) => item.active && !item.deletedAt);
  const available = active.filter((item) => item.stockRemaining > 0);
  const cheapest = [...(available.length ? available : active)].sort(
    (a, b) => a.price - b.price,
  )[0];
  return {
    price: cheapest?.price ?? 0,
    oldPrice: cheapest?.oldPrice ?? null,
    discount:
      cheapest?.oldPrice && cheapest.oldPrice > cheapest.price
        ? `-${Math.round((1 - cheapest.price / cheapest.oldPrice) * 100)}%`
        : null,
    stockTotal: active.reduce((sum, item) => sum + item.stockTotal, 0),
    stockRemaining: active.reduce((sum, item) => sum + item.stockRemaining, 0),
  };
}

export async function refreshCouponSummary(
  manager: EntityManager,
  coupon: PortalCoupon,
) {
  const packages = await manager
    .getRepository(PortalCouponPackage)
    .find({ where: { couponId: coupon.id } });
  Object.assign(coupon, couponPackageSummary(packages));
  await manager
    .getRepository(PortalCoupon)
    .update(coupon.id, couponPackageSummary(packages));
}
