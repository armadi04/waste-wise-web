import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class EmailOtpRequestDto {
  @ApiPropertyOptional({
    description: 'Cloudflare Turnstile verification token',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  turnstileToken?: string;

  @ApiProperty({ example: 'raka@example.com' })
  @IsEmail()
  email: string;
}

export class EmailOtpVerifyDto {
  @ApiProperty({ example: 'raka@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;
}
