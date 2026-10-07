import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class PurchaseLimitQueryDto {
  @ApiProperty({ enum: ['coupon', 'ticket', 'bundle'] })
  @IsIn(['coupon', 'ticket', 'bundle'])
  kind: 'coupon' | 'ticket' | 'bundle';

  @ApiProperty({ example: 'late-night-tasting-cocktails' })
  @IsString()
  @IsNotEmpty()
  slug: string;
}

export class PurchaseLimitResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Remaining units; null means no per-user cap.',
  })
  remaining: number | null;
}
