import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';

export class ConfirmReferralDto {
  @ApiProperty() @IsString() @Matches(/^REF-[A-F0-9]{24}$/) code: string;
}

export class CampaignAdjustmentDto {
  @ApiProperty() @IsInt() @Min(1) userId: number;
  @ApiProperty() @IsInt() @Min(1) campaignId: number;
  @ApiProperty() @IsInt() @Min(-2147483647) @Max(2147483647) points: number;
  @ApiProperty() @IsString() @Length(5, 500) reason: string;
  @ApiProperty({ description: 'Stable unique key for this adjustment' })
  @IsString()
  @Length(8, 80)
  idempotencyKey: string;
}
