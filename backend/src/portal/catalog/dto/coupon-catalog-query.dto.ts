import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogQueryDto } from '@/portal/catalog/dto/catalog-query.dto';

const optionalNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value.trim() === ''
      ? undefined
      : Number(value)
    : value;

export class CouponCatalogQueryDto extends CatalogQueryDto {
  @ApiPropertyOptional({
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    description: 'Inclusive minimum catalog starting price in IDR',
  })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  minPrice?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    description:
      'Inclusive maximum catalog starting price in IDR; must be >= minPrice',
  })
  @IsOptional()
  @Transform(optionalNumber)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  maxPrice?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    description:
      'Minimum rounded percentage discount on the catalog starting price',
  })
  @IsOptional()
  @Transform(optionalNumber)
  @IsNumber()
  @Min(0)
  @Max(100)
  minDiscount?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 5,
    description:
      'Minimum average review rating, rounded to one decimal; unrated coupons are excluded',
  })
  @IsOptional()
  @Transform(optionalNumber)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;
}
