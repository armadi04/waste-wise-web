import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, ValidateBy } from 'class-validator';
import { isTimeZone } from '@/common/utils/business-time';

export class TimeZonePreferenceDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateBy({
    name: 'isTimeZone',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && isTimeZone(value),
    },
  })
  timeZone?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateBy({
    name: 'isTimeZone',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && isTimeZone(value),
    },
  })
  lastDetectedTimeZone?: string | null;
}

export class PreviewTimeDto {
  @ApiProperty()
  @IsString()
  localDateTime: string;

  @ApiProperty()
  @IsString()
  timeZone: string;
}

export class TimeZonePreferenceResponseDto {
  @ApiProperty({ type: String, nullable: true })
  timeZone: string | null;
  @ApiProperty({ type: String, nullable: true })
  lastDetectedTimeZone: string | null;
}
export class TimeZoneConfigResponseDto {
  @ApiProperty()
  defaultTimeZone: string;
  @ApiProperty({ type: [String] })
  businessTimeZones: readonly string[];
}
export class TimePreviewResponseDto {
  @ApiProperty()
  instant: string;
  @ApiProperty()
  localDateTime: string;
  @ApiProperty()
  timeZone: string;
}
