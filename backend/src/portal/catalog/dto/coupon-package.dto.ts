import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CouponImageDto {
  @ApiProperty()
  @IsUrl({
    require_tld: false,
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @MaxLength(255)
  url: string;
  @ApiProperty() @IsString() @MaxLength(240) alt: string;
}
export class CouponPackageDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() publicId?: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(180) name: string;
  @ApiProperty() @IsString() benefits: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) price: number;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  oldPrice?: number | null;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) stockTotal: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class ClaimCouponDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() packagePublicId?: string;
}
