import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class PortalPaymentWebhookDto {
  @ApiProperty({ example: 'ORD-AB12CD34' })
  @IsString()
  @MinLength(1)
  orderNumber: string;

  @ApiProperty({ enum: ['paid', 'failed', 'refunded', 'refund_failed'] })
  @IsIn(['paid', 'failed', 'refunded', 'refund_failed'])
  status: string;

  @ApiPropertyOptional({ example: 'va-20260917-1234' })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiPropertyOptional({ enum: ['va'] })
  @IsOptional()
  @IsIn(['va'])
  paymentMethod?: string;
}
