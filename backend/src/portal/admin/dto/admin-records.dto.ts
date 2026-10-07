import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  NotEquals,
} from 'class-validator';
import { PaginationParamsDto } from '@/common/dto/pagination-params.dto';

export class PortalAdminRecordQueryDto extends PaginationParamsDto {
  @ApiPropertyOptional({ description: 'Only records belonging to this user' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;
}

export class PortalGiftQueryDto extends PortalAdminRecordQueryDto {
  @ApiPropertyOptional({ enum: ['Ready', 'Redeemed', 'Revoked'] })
  @IsOptional()
  @IsIn(['Ready', 'Redeemed', 'Revoked'])
  status?: string;
}

export class PortalOutboxQueryDto extends PaginationParamsDto {
  @ApiPropertyOptional({
    type: Boolean,
    description: 'true: delivered events, false: pending events',
  })
  @IsOptional()
  @Transform(({ value }): unknown =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  delivered?: boolean;
}

export class RevokePortalGiftDto {
  @ApiProperty({ minLength: 5, maxLength: 500 })
  @IsString()
  @Length(5, 500)
  reason: string;
}

export class PortalWalletAdjustmentDto {
  @ApiProperty() @IsInt() @Min(1) userId: number;

  @ApiProperty({ description: 'Coins to add (positive) or remove (negative)' })
  @IsInt()
  @NotEquals(0)
  @Min(-100000000)
  @Max(100000000)
  amount: number;

  @ApiProperty({ minLength: 5, maxLength: 150 })
  @IsString()
  @Length(5, 150)
  reason: string;

  @ApiProperty({ description: 'Stable unique key for this adjustment' })
  @IsString()
  @Length(8, 80)
  idempotencyKey: string;
}

export class PortalWalletAdjustmentResponseDto {
  @ApiProperty() userId: number;
  @ApiProperty() balance: number;
  @ApiProperty() lifetimeEarned: number;
  @ApiProperty({ description: 'False when the idempotency key was replayed' })
  applied: boolean;
}

export class PortalCustomerDto {
  @ApiProperty() id: number;
  @ApiProperty() email: string;
  @ApiProperty() fullname: string;
  @ApiProperty({ nullable: true }) phone: string | null;
  @ApiProperty() registerMethod: string;
  @ApiProperty() notificationsEnabled: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() orderCount: number;
  @ApiProperty() paidOrderCount: number;
  @ApiProperty() walletBalance: number;
  @ApiProperty({ nullable: true }) lastOrderAt: Date | null;
}

export class PortalCustomerSummaryDto extends PortalCustomerDto {
  @ApiProperty() lifetimeEarned: number;
  @ApiProperty() voucherCount: number;
  @ApiProperty() ticketCount: number;
  @ApiProperty() giftsSent: number;
  @ApiProperty() bookingCount: number;
  @ApiProperty({ nullable: true }) referralCode: string | null;
  @ApiProperty({ nullable: true }) referredByUserId: number | null;
  @ApiProperty() referredCount: number;
}
