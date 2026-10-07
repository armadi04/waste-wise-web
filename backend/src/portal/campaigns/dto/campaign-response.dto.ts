import { ApiProperty } from '@nestjs/swagger';
import { CampaignRulesDto } from '@/portal/campaigns/dto/campaign-rules.dto';

export class CampaignProductResponseDto {
  @ApiProperty({ enum: ['coupon', 'event'] }) kind: string;
  @ApiProperty() slug: string;
  @ApiProperty() title: string;
}
export class CampaignResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() publicId: string;
  @ApiProperty() slug: string;
  @ApiProperty() title: string;
  @ApiProperty() description: string;
  @ApiProperty() rewardLabel: string;
  @ApiProperty() imageUrl: string;
  @ApiProperty() targetPoints: number;
  @ApiProperty() active: boolean;
  @ApiProperty({ type: CampaignRulesDto, nullable: true })
  rules: CampaignRulesDto | null;
  @ApiProperty({ type: [CampaignProductResponseDto] })
  eligibleProducts: CampaignProductResponseDto[];
}
export class CampaignPageMetaDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() lastPage: number;
}
export class CampaignListResponseDto {
  @ApiProperty({ type: [CampaignResponseDto] }) data: CampaignResponseDto[];
  @ApiProperty({ type: CampaignPageMetaDto }) meta: CampaignPageMetaDto;
}
export class CampaignRewardResponseDto {
  @ApiProperty({
    enum: [
      'available',
      'reserved',
      'used',
      'revoked',
      'expired',
      'unavailable',
    ],
  })
  status: string;
  @ApiProperty({ type: String, nullable: true }) code: string | null;
  @ApiProperty({ format: 'date-time' }) expiresAt: Date;
}
export class CampaignProgressResponseDto {
  @ApiProperty() points: number;
  @ApiProperty() targetPoints: number;
  @ApiProperty() status: string;
  @ApiProperty() eligible: boolean;
  @ApiProperty({ type: CampaignRewardResponseDto, nullable: true })
  reward: CampaignRewardResponseDto | null;
}
export class MyCampaignResponseDto {
  @ApiProperty() slug: string;
  @ApiProperty() title: string;
  @ApiProperty() rewardLabel: string;
  @ApiProperty() imageUrl: string;
  @ApiProperty({
    description: 'True once the user has a progress row for the campaign',
  })
  participating: boolean;
  @ApiProperty({ type: CampaignProgressResponseDto })
  progress: CampaignProgressResponseDto;
}
export class MyCampaignListResponseDto {
  @ApiProperty({ type: [MyCampaignResponseDto] })
  data: MyCampaignResponseDto[];
  @ApiProperty({ type: CampaignPageMetaDto }) meta: CampaignPageMetaDto;
}
export class CampaignLedgerResponseDto {
  @ApiProperty() id: number;
  @ApiProperty({
    enum: [
      'payment',
      'usage',
      'referral',
      'reversal',
      'adjustment',
      'baseline',
    ],
  })
  kind: string;
  @ApiProperty() points: number;
  @ApiProperty() reason: string;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
}
export class CampaignHistoryResponseDto {
  @ApiProperty({ type: [CampaignLedgerResponseDto] })
  data: CampaignLedgerResponseDto[];
  @ApiProperty({ type: CampaignPageMetaDto }) meta: CampaignPageMetaDto;
}
export class ReferralResponseDto {
  @ApiProperty() code: string;
  @ApiProperty() hasReferrer: boolean;
  @ApiProperty() canConfirm: boolean;
}
export class ConfirmReferralResponseDto {
  @ApiProperty() confirmed: boolean;
}
export class VerifyCampaignUsageResponseDto {
  @ApiProperty() verified: boolean;
}
export class CampaignAdjustmentResponseDto {
  @ApiProperty() adjusted: boolean;
}
