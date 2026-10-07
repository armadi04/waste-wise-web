import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
  Max,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePortalOrderDto {
  @ApiProperty({ enum: ['ticket', 'coupon', 'bundle'] })
  @IsIn(['ticket', 'coupon', 'bundle'])
  kind: string;

  @ApiProperty({ example: 'neon-pulse-midnight-techno' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional({ example: 'Early Bird' })
  @IsOptional()
  @IsString()
  ticketType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  packagePublicId?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  quantity?: number;

  @ApiPropertyOptional({ type: [String], minItems: 1, maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(180, { each: true })
  attendees?: string[];

  @ApiProperty({ example: 'Raka Pratama' })
  @IsString()
  @IsNotEmpty()
  attendee: string;

  @ApiProperty({ example: 'raka@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+6281234567890' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'NIGHTOWL' })
  @IsOptional()
  @IsString()
  promoCode?: string;
}

export class RequestPortalRefundDto {
  @ApiProperty({ example: 'Jadwal berubah dan saya belum memakai voucher.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
