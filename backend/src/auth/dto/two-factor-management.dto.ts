import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorStatusDto {
  @ApiProperty()
  enabled: boolean;

  @ApiProperty({ description: 'Unused recovery codes left' })
  recoveryCodesRemaining: number;
}

export class TwoFactorEnrollmentDto {
  @ApiProperty({ description: 'Base32 TOTP secret for manual entry' })
  secret: string;

  @ApiProperty({ description: 'otpauth:// URI for authenticator apps' })
  otpauthUrl: string;

  @ApiProperty({ description: 'PNG data URL of the otpauth QR code' })
  qrDataUrl: string;
}

export class RecoveryCodesDto {
  @ApiProperty({
    type: [String],
    description: 'One-time recovery codes; shown only once',
  })
  recoveryCodes: string[];
}

export class MessageResponseDto {
  @ApiProperty()
  message: string;
}
