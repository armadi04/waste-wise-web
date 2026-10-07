import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CampaignDiscountDto {
  @ApiProperty({ enum: ['fixed', 'percentage'] })
  @IsIn(['fixed', 'percentage'])
  kind: 'fixed' | 'percentage';
  @ApiProperty() @IsInt() @Min(1) @Max(2147483647) value: number;
  @ApiProperty() @IsInt() @Min(0) @Max(2147483647) minimumOrder: number;
  @ApiProperty({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  maximumDiscount: number | null;
}

export class CampaignRulesDto {
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true, strictSeparator: true })
  startsAt: string;
  @ApiProperty() @IsInt() @Min(0) @Max(2147483647) paymentPoints: number;
  @ApiProperty() @IsInt() @Min(0) @Max(2147483647) usagePoints: number;
  @ApiProperty() @IsInt() @Min(0) @Max(2147483647) referralPoints: number;
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  couponIds: number[];
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMaxSize(100)
  @IsInt({ each: true })
  @Min(1, { each: true })
  eventIds: number[];
  @ApiProperty({ type: CampaignDiscountDto })
  @ValidateNested()
  @Type(() => CampaignDiscountDto)
  reward: CampaignDiscountDto;
}
