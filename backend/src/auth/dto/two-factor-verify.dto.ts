import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorVerifyDto {
  @ApiProperty({ description: 'The challenge token returned by /auth/login' })
  @IsString()
  challengeToken: string;

  @ApiProperty({
    description:
      'A 6-digit code from the authenticator app, or a recovery code',
  })
  @IsString()
  @Length(6, 32)
  code: string;
}
