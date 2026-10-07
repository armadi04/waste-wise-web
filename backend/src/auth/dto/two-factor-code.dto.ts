import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TwoFactorCodeDto {
  @ApiProperty({
    description:
      'A 6-digit code from the authenticator app, or a recovery code',
  })
  @IsString()
  @Length(6, 32)
  code: string;
}
