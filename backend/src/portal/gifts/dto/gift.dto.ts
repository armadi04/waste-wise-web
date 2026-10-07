import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePortalGiftDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  packagePublicId?: string;

  @ApiProperty({ example: 'late-night-tasting-cocktails' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'Nadia' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  recipientName: string;

  @ApiProperty({ example: 'nadia@example.com' })
  @IsEmail()
  recipientEmail: string;

  @ApiPropertyOptional({ example: 'Selamat ulang tahun!' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}
