import { ApiProperty } from '@nestjs/swagger';

export class MobileTwoFactorChallengeDto {
  @ApiProperty({ example: true })
  twoFactorRequired: boolean;

  @ApiProperty()
  challengeToken: string;
}
