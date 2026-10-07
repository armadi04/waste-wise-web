import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PassQrResponseDto {
  @ApiProperty({
    example: 'KM1.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Short-lived signed token to encode in the customer QR',
  })
  token: string;

  @ApiProperty({ example: '2026-10-03T01:00:00.000Z' })
  expiresAt: string;

  @ApiProperty({
    example: 60,
    description:
      'Token lifetime in seconds; clients count down from receipt instead of trusting the device clock',
  })
  expiresIn: number;
}

export class ScanPassDto {
  @ApiProperty({ example: 'KM1.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  token: string;
}
