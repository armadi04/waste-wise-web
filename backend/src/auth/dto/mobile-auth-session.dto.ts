import { ApiProperty } from '@nestjs/swagger';

export class MobileAuthSessionDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: String, format: 'date-time' })
  sessionExpiresAt: Date;
}
