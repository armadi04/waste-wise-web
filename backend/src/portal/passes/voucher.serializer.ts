import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { voucherDisplayStatus } from '@/portal/passes/pass-status';
import { dateLabel } from '@/portal/shared/date-label';
export function serializeVoucher(
  voucher: PortalVoucher,
  coupon?: PortalCoupon,
  orderId: string | null = null,
) {
  return {
    id: voucher.code,
    orderId,
    publicId: voucher.publicId,
    title: coupon?.title ?? 'Voucher KuponMalam',
    expiresAt: voucher.expiresAt,
    timeZone: voucher.timeZone,
    meta: `Berlaku sampai ${dateLabel(voucher.expiresAt, voucher.timeZone)}`,
    venue: coupon?.merchant ?? '',
    attendee: '',
    targetKey: coupon?.slug ?? '',
    status: voucherDisplayStatus(voucher.status, voucher.expiresAt),
    image: voucher.imageUrl,
    package: voucher.packageSnapshot ?? undefined,
  };
}
