import type { OrderItemProductType } from '@/portal/commerce/order-item';
import { createHash } from 'crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { CreatePortalOrderDto } from '@/portal/commerce/dto/order.dto';

export function normalizePurchase(dto: CreatePortalOrderDto) {
  const quantity = dto.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10)
    throw new BadRequestException(
      'Quantity must be an integer between 1 and 10',
    );
  const attendee = dto.attendee.trim();
  const attendees =
    dto.kind === 'coupon'
      ? []
      : (dto.attendees?.map((name) => name.trim()) ??
        (quantity === 1 ? [attendee] : []));
  if (
    dto.kind !== 'coupon' &&
    (attendees.length !== quantity || attendees.some((name) => !name))
  )
    throw new BadRequestException(
      'One participant name is required per ticket',
    );
  if (
    dto.kind !== 'coupon' &&
    quantity === 1 &&
    dto.attendees &&
    attendees[0] !== attendee
  )
    throw new BadRequestException('Participant and legacy attendee conflict');
  const input = {
    kind: dto.kind,
    slug: dto.slug.trim(),
    ticketType: dto.ticketType?.trim() ?? null,
    packagePublicId: dto.packagePublicId ?? null,
    quantity,
    attendee,
    attendees,
    email: dto.email.trim(),
    phone: dto.phone.trim(),
    promoCode: dto.promoCode?.trim().toUpperCase() || null,
  };
  return {
    input,
    fingerprint: createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex'),
  };
}

export function splitValue(
  value: number,
  couponPrice: number,
  ticketPrice: number,
) {
  const weight = couponPrice + ticketPrice;
  const coupon = Math.floor(value * (weight ? couponPrice / weight : 0.5));
  return { coupon, ticket: value - coupon };
}

export function saleDeadline(...dates: Array<Date | null | undefined>) {
  return new Date(
    Math.min(
      ...dates
        .filter((date): date is Date => !!date)
        .map((date) => new Date(date).getTime()),
    ),
  );
}

export function assertPurchaseLimit(
  quantity: number,
  product: { maxPerOrder?: number | null; maxPerUser?: number | null },
  used: number,
) {
  if (
    quantity > Math.min(10, product.maxPerOrder ?? 10) ||
    (product.maxPerUser != null && used + quantity > product.maxPerUser)
  )
    throw new ConflictException('Purchase limit reached');
}

export interface BenefitSnapshot {
  role: 'price' | 'benefit';
  bundleId?: number | null;
  unitIndex?: number;
  allocation?: { subtotal: number; discount: number; total: number };
  couponId?: number | null;
  eventId?: number | null;
  ticketTypeId?: number | null;
  attendee?: string;
  imageUrl?: string;
  expiresAt?: string | null;
  validityDays?: number | null;
  salesEndsAt?: string | null;
  eventStartsAt?: string | null;
  ticketSalesEndsAt?: string | null;
  timeZone?: string;
}
export interface PurchaseItemSnapshot {
  id: number;
  title: string;
  productType: OrderItemProductType;
  quantity: number;
  unitPrice: number;
  unitIndex?: number;
  attendee?: string;
  allocation?: { subtotal: number; discount: number; total: number };
}
export interface PurchaseSnapshot {
  version: number;
  input: ReturnType<typeof normalizePurchase>['input'];
  resources: Record<string, number>;
  promo: {
    kind: string;
    value: number;
    maximumDiscount: number | null;
    minimumOrder: number;
  } | null;
  unitPrice: number;
  subtotal: number;
  discount: number;
  total: number;
  items: PurchaseItemSnapshot[];
}
