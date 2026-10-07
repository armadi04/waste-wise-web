import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePortalSavedOfferDto {
  @ApiProperty({ enum: ['coupon', 'event'] })
  @IsIn(['coupon', 'event'])
  targetType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  targetKey: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  targetName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  imageUrl: string;
}

export class SavedOfferQueryDto {
  @ApiPropertyOptional({ enum: ['coupon', 'event'] })
  @IsOptional()
  @IsIn(['coupon', 'event'])
  targetType?: string;
}
