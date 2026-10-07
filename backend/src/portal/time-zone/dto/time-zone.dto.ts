import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateBy,
  ValidateIf,
} from 'class-validator';
import {
  BUSINESS_TIME_ZONES,
  isTimeZone,
  isLocalDateTime,
} from '@/common/utils/business-time';
export class TimeZonePreferenceDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'IANA time zone; null follows the device',
  })
  @IsOptional()
  @ValidateBy({ name: 'ianaTimeZone', validator: { validate: isTimeZone } })
  timeZone?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @ValidateBy({
    name: 'ianaDetectedTimeZone',
    validator: { validate: isTimeZone },
  })
  lastDetectedTimeZone?: string | null;
}
export class PreviewTimeDto {
  @ApiProperty()
  @ValidateBy({
    name: 'localDateTime',
    validator: { validate: isLocalDateTime },
  })
  localDateTime: string;
  @ApiProperty({ enum: BUSINESS_TIME_ZONES })
  @IsIn(BUSINESS_TIME_ZONES)
  timeZone: string;
}
export class ScheduleTimeDto {
  @ApiPropertyOptional({ enum: BUSINESS_TIME_ZONES })
  @ValidateIf((_dto, value: unknown) => value !== undefined)
  @IsIn(BUSINESS_TIME_ZONES)
  timeZone?: string;
  @ApiPropertyOptional({
    description:
      'Local wall times keyed by timestamp field; do not send the absolute field as well',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  localTimes?: Record<string, string>;
  @ApiPropertyOptional({ enum: ['preserveInstant', 'preserveLocal'] })
  @IsOptional()
  @IsIn(['preserveInstant', 'preserveLocal'])
  timeZoneChangeMode?: 'preserveInstant' | 'preserveLocal';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  timeZoneChangeReason?: string;
}

export class TimeZoneConfigResponseDto {
  @ApiProperty({ example: 'Asia/Jakarta' }) defaultTimeZone: string;
  @ApiProperty({ type: [String], enum: BUSINESS_TIME_ZONES })
  businessTimeZones: string[];
}
export class TimeZonePreferenceResponseDto {
  @ApiProperty({ type: String, nullable: true }) timeZone: string | null;
  @ApiProperty({ type: String, nullable: true }) lastDetectedTimeZone:
    string | null;
}
export class TimePreviewResponseDto {
  @ApiProperty({ format: 'date-time', example: '2026-10-02T11:00:00.000Z' })
  instant: string;
  @ApiProperty() localDateTime: string;
  @ApiProperty({ enum: BUSINESS_TIME_ZONES }) timeZone: string;
}
