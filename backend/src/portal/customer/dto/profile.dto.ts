import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdatePortalProfileDto {
  @ApiPropertyOptional()
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  preferredCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}

export class PortalProfileResponseDto {
  @ApiProperty() id: number;
  @ApiProperty({ type: String, nullable: true }) avatarUrl: string | null;
  @ApiProperty() avatarImportPending: boolean;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty() phone: string;
  @ApiProperty() preferredCity: string;
  @ApiProperty() notificationsEnabled: boolean;
}
