import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MobileRefreshTokenDto {
  @ApiProperty({
    description: 'WasteWise refresh token issued to a mobile client',
  })
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}
