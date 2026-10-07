import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePortalReviewDto {
  @ApiProperty({ enum: ['coupon', 'event'] })
  @IsIn(['coupon', 'event'])
  targetType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  targetKey: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body: string;
}

export class ReviewQueryDto {
  @ApiPropertyOptional({ enum: ['coupon', 'event'] })
  @IsOptional()
  @IsIn(['coupon', 'event'])
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetKey?: string;
}
