import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CouponCategoryQueryDto {
  @ApiPropertyOptional({ example: 'Jakarta' })
  @IsOptional()
  @IsString()
  city?: string;
}

export class CouponCategoryResponseDto {
  @ApiProperty({
    example: 'Kuliner malam',
    description: 'Exact label accepted by the catalog `category` filter',
  })
  name: string;

  @ApiProperty({ example: 12, description: 'Active coupons in this category' })
  count: number;

  @ApiProperty({
    example: 'kuliner-malam',
    nullable: true,
    description: 'Also accepted by the catalog `category` filter',
  })
  slug: string | null;

  @ApiProperty({
    example: 'Makan',
    nullable: true,
    description: 'Short home lane label',
  })
  label: string | null;

  @ApiProperty({ nullable: true }) blurb: string | null;

  @ApiProperty({ example: 'utensils', nullable: true }) icon: string | null;

  @ApiProperty({ nullable: true }) position: number | null;

  @ApiProperty({ description: 'Shown as a curated home lane' })
  featured: boolean;
}
