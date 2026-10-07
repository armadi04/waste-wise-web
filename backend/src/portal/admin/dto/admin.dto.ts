import {
  FOLLOW_TARGET_TYPES,
  type FollowTargetType,
} from '@/portal/customer/follow-target';
import {
  ORDER_ITEM_PRODUCT_TYPES,
  type OrderItemProductType,
} from '@/portal/commerce/order-item';
import { CampaignRulesDto } from '@/portal/campaigns/dto/campaign-rules.dto';
import { ScheduleTimeDto } from '@/portal/time-zone/dto/time-zone.dto';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { parseBusinessDate } from '@/common/utils/business-time';
import {
  ValidateIf,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsDate,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsUnique } from '@/common/validators/is-unique.validator';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';

import {
  CouponImageDto,
  CouponPackageDto,
} from '@/portal/catalog/dto/coupon-package.dto';

export class BasePortalCouponDto extends ScheduleTimeDto {
  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerOrder?: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerUser?: number | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value == null ? value : parseBusinessDate(value as string | Date),
  )
  @IsDate()
  salesEndsAt?: Date | null;
  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays?: number | null;

  @ApiPropertyOptional({ type: [CouponImageDto], minItems: 1, maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CouponImageDto)
  images?: CouponImageDto[];

  @ApiPropertyOptional({ type: [CouponPackageDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CouponPackageDto)
  packages?: CouponPackageDto[];

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Optional custom URL slug. Generated from title when omitted.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  slug?: string;

  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title: string;

  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  merchant: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city: string;

  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  location: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  category: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  oldPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  discount?: string | null;

  @ApiPropertyOptional({
    description:
      'Required unless supplied in localTimes. RFC 3339 timestamp with explicit offset; responses use UTC Z. Zone-less absolute values are rejected.',
  })
  @Transform(({ value }: { value: unknown }) =>
    value == null ? value : parseBusinessDate(value as string | Date),
  )
  @ValidateIf(
    (dto: ScheduleTimeDto & { validityDays?: number }) =>
      !dto.validityDays && dto.localTimes?.expiresAt === undefined,
  )
  @IsDate()
  expiresAt?: Date;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockTotal: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockRemaining: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  imageUrl: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  benefits: string;

  @ApiProperty()
  @IsString()
  terms: string;

  @ApiProperty()
  @IsString()
  redemption: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreatePortalCouponDto extends BasePortalCouponDto {}

export class UpdatePortalCouponDto extends PartialType(BasePortalCouponDto) {}

export class BasePortalEventDto extends ScheduleTimeDto {
  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerOrder?: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerUser?: number | null;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Optional custom URL slug. Generated from title when omitted.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  slug?: string;

  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  type: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @MaxLength(40)
  dateLabel: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @MaxLength(40)
  monthLabel: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @MaxLength(40)
  dayLabel: string;

  @ApiPropertyOptional({
    description:
      'Required unless supplied in localTimes. RFC 3339 timestamp with explicit offset; responses use UTC Z. Zone-less absolute values are rejected.',
  })
  @Transform(({ value }: { value: unknown }) =>
    value == null ? value : parseBusinessDate(value as string | Date),
  )
  @ValidateIf((dto: ScheduleTimeDto) => dto.localTimes?.startsAt === undefined)
  @IsDate()
  startsAt?: Date;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  venue: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiProperty({ maxLength: 40 })
  @IsString()
  @MaxLength(40)
  timeLabel: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  basePrice: number;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  statusLabel: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  imageUrl: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreatePortalEventDto extends BasePortalEventDto {}

export class UpdatePortalEventDto extends PartialType(BasePortalEventDto) {}

export class BasePortalEventTicketDto {
  @ApiPropertyOptional({ type: Date, nullable: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value == null ? value : parseBusinessDate(value as string | Date),
  )
  @IsDate()
  salesEndsAt?: Date | null;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  eventId: number;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  description: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockTotal: number;

  @ApiPropertyOptional({
    description:
      'Create only; defaults to stockTotal. Updates derive it from stockTotal.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  stockRemaining?: number;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  statusLabel: string;
}

export class CreatePortalEventTicketDto extends BasePortalEventTicketDto {}
export class UpdatePortalEventTicketDto extends PartialType(
  BasePortalEventTicketDto,
) {}

export class BasePortalBundleDto {
  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerOrder?: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerUser?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  packageId?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ticketTypeId?: number | null;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Optional custom URL slug. Generated from title when omitted.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  slug?: string;

  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  couponSlug: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  eventSlug: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  imageUrl: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreatePortalBundleDto extends BasePortalBundleDto {}

export class UpdatePortalBundleDto extends PartialType(BasePortalBundleDto) {}

export class BasePortalCampaignDto {
  @ApiPropertyOptional({ type: CampaignRulesDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignRulesDto)
  rules?: CampaignRulesDto | null;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Optional custom URL slug. Generated from title when omitted.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  slug?: string;

  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @MaxLength(120)
  rewardLabel: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  imageUrl: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  targetPoints: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreatePortalCampaignDto extends BasePortalCampaignDto {}

export class UpdatePortalCampaignDto extends PartialType(
  BasePortalCampaignDto,
) {}

export class BasePortalFaqDto {
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  position?: number;

  @ApiProperty({ maxLength: 240 })
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  question: string;

  @ApiProperty()
  @IsString()
  answer: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreatePortalFaqDto extends BasePortalFaqDto {}
export class UpdatePortalFaqDto extends PartialType(BasePortalFaqDto) {}

export class BasePortalVoucherDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  userId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  couponId: number;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  code: string;

  @ApiProperty({ maxLength: 32 })
  @IsString()
  @MaxLength(32)
  status: string;

  @ApiProperty({
    description:
      'RFC 3339 timestamp with explicit offset; responses use UTC Z. Zone-less absolute values are rejected.',
  })
  @Transform(({ value }: { value: unknown }) =>
    value == null ? value : parseBusinessDate(value as string | Date),
  )
  @IsDate()
  expiresAt: Date;

  @ApiPropertyOptional({
    description:
      'RFC 3339 timestamp with explicit offset; responses use UTC Z. Zone-less absolute values are rejected.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value == null ? value : parseBusinessDate(value as string | Date),
  )
  @IsDate()
  redeemedAt?: Date | null;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  imageUrl: string;
}

export class CreatePortalVoucherDto extends BasePortalVoucherDto {
  @IsUnique(PortalVoucher, 'code')
  declare code: string;
}

export class UpdatePortalVoucherDto extends PartialType(BasePortalVoucherDto, {
  skipNullProperties: false,
}) {}

export class BasePortalTicketDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  userId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  eventId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  ticketTypeId: number;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  code: string;

  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MaxLength(180)
  attendee: string;

  @ApiProperty({ maxLength: 32 })
  @IsString()
  @MaxLength(32)
  status: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  imageUrl: string;

  @ApiPropertyOptional({
    description:
      'RFC 3339 timestamp with explicit offset; responses use UTC Z. Zone-less absolute values are rejected.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value == null ? value : parseBusinessDate(value as string | Date),
  )
  @IsDate()
  checkedInAt?: Date | null;
}

export class CreatePortalTicketDto extends BasePortalTicketDto {
  @IsUnique(PortalTicket, 'code')
  declare code: string;
}

export class UpdatePortalTicketDto extends PartialType(BasePortalTicketDto, {
  skipNullProperties: false,
}) {}

export class BasePortalOrderDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  userId: number;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  orderNumber: string;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  idempotencyKey: string;

  @ApiProperty({ maxLength: 32 })
  @IsString()
  @MaxLength(32)
  status: string;

  @ApiProperty({ enum: ['ticket', 'coupon', 'bundle'] })
  @IsIn(['ticket', 'coupon', 'bundle'])
  kind: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  total: number;

  @ApiPropertyOptional({ default: 'IDR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MaxLength(180)
  title: string;

  @ApiProperty()
  @IsString()
  meta: string;
}

export class CreatePortalOrderDto extends BasePortalOrderDto {
  @IsUnique(PortalOrder, 'orderNumber')
  declare orderNumber: string;
}

export class UpdatePortalOrderDto extends PartialType(BasePortalOrderDto) {}

export class BasePortalOrderItemDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  orderId: number;

  @ApiProperty({ enum: ORDER_ITEM_PRODUCT_TYPES })
  @IsIn(ORDER_ITEM_PRODUCT_TYPES)
  productType: OrderItemProductType;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  productId: number;

  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MaxLength(180)
  title: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;
}

export class CreatePortalOrderItemDto extends BasePortalOrderItemDto {}
export class UpdatePortalOrderItemDto extends PartialType(
  BasePortalOrderItemDto,
) {}

export class BasePortalFollowDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  userId: number;

  @ApiProperty({ enum: FOLLOW_TARGET_TYPES })
  @IsIn(FOLLOW_TARGET_TYPES)
  targetType: FollowTargetType;

  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  targetKey: string;

  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MaxLength(180)
  targetName: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  imageUrl: string;
}

export class CreatePortalFollowDto extends BasePortalFollowDto {}
export class UpdatePortalFollowDto extends PartialType(BasePortalFollowDto) {}

export class BasePortalEmailOtpChallengeDto {
  @ApiProperty({ maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  email: string;

  @ApiProperty({ maxLength: 32 })
  @IsString()
  @MaxLength(32)
  purpose: string;

  @ApiProperty({
    description:
      'RFC 3339 timestamp with explicit offset; responses use UTC Z. Zone-less absolute values are rejected.',
  })
  @Transform(({ value }: { value: unknown }) =>
    value == null ? value : parseBusinessDate(value as string | Date),
  )
  @IsDate()
  expiresAt: Date;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  attempts?: number;

  @ApiPropertyOptional({
    description:
      'RFC 3339 timestamp with explicit offset; responses use UTC Z. Zone-less absolute values are rejected.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value == null ? value : parseBusinessDate(value as string | Date),
  )
  @IsDate()
  consumedAt?: Date | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestIp?: string | null;

  @ApiPropertyOptional({
    description:
      'RFC 3339 timestamp with explicit offset; responses use UTC Z. Zone-less absolute values are rejected.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value == null ? value : parseBusinessDate(value as string | Date),
  )
  @IsDate()
  lastSentAt?: Date | null;
}

export class CreatePortalEmailOtpChallengeDto extends BasePortalEmailOtpChallengeDto {}
export class UpdatePortalEmailOtpChallengeDto extends PartialType(
  BasePortalEmailOtpChallengeDto,
) {}

export class BasePortalPromoCodeDto {
  @ApiProperty({ maxLength: 40 })
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  code: string;

  @ApiProperty({ enum: ['percentage', 'fixed'] })
  @IsIn(['percentage', 'fixed'])
  kind: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  value: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minimumOrder?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  maximumDiscount?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  usageLimit?: number | null;

  @ApiProperty({
    description:
      'RFC 3339 timestamp with explicit offset; responses use UTC Z. Zone-less absolute values are rejected.',
  })
  @Transform(({ value }: { value: unknown }) =>
    value == null ? value : parseBusinessDate(value as string | Date),
  )
  @IsDate()
  expiresAt: Date;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreatePortalPromoCodeDto extends BasePortalPromoCodeDto {}
export class UpdatePortalPromoCodeDto extends PartialType(
  BasePortalPromoCodeDto,
) {}

export class BasePortalBookingSlotDto extends ScheduleTimeDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  eventId: number;

  @ApiPropertyOptional({
    description:
      'Required unless supplied in localTimes. RFC 3339 timestamp with explicit offset; responses use UTC Z. Zone-less absolute values are rejected.',
  })
  @Transform(({ value }: { value: unknown }) =>
    value == null ? value : parseBusinessDate(value as string | Date),
  )
  @ValidateIf((dto: ScheduleTimeDto) => dto.localTimes?.startsAt === undefined)
  @IsDate()
  startsAt?: Date;

  @ApiPropertyOptional({
    description:
      'Required unless supplied in localTimes. RFC 3339 timestamp with explicit offset; responses use UTC Z. Zone-less absolute values are rejected.',
  })
  @Transform(({ value }: { value: unknown }) =>
    value == null ? value : parseBusinessDate(value as string | Date),
  )
  @ValidateIf((dto: ScheduleTimeDto) => dto.localTimes?.endsAt === undefined)
  @IsDate()
  endsAt?: Date;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacity: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  remaining?: number;

  @ApiPropertyOptional({ default: 'Available' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;
}

export class CreatePortalBookingSlotDto extends BasePortalBookingSlotDto {}
export class UpdatePortalBookingSlotDto extends PartialType(
  BasePortalBookingSlotDto,
) {}

export class UpdatePortalReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  merchantReply?: string | null;
}

export class UpdatePortalBookingDto {
  @ApiPropertyOptional({ maxLength: 180 })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  attendee?: string;

  @ApiPropertyOptional({
    enum: ['Reserved', 'Confirmed', 'Cancelled', 'Completed'],
  })
  @IsOptional()
  @IsIn(['Reserved', 'Confirmed', 'Cancelled', 'Completed'])
  status?: string;
}
