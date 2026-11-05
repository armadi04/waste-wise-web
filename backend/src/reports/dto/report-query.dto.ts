import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationParamsDto } from '@/common/dto/pagination-params.dto';
import { ReportStatus, WasteCategory } from '../entities/report.entity';

/** Query-only category value matching reports without an AI category. */
export const UNCLASSIFIED_CATEGORY = 'UNCLASSIFIED' as const;

export const REPORT_CATEGORY_FILTERS = [
  ...Object.values(WasteCategory),
  UNCLASSIFIED_CATEGORY,
];

export type ReportCategoryFilter = WasteCategory | typeof UNCLASSIFIED_CATEGORY;

export class ReportQueryDto extends PaginationParamsDto {
  @ApiPropertyOptional({ enum: ReportStatus })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional({
    enum: REPORT_CATEGORY_FILTERS,
    description: 'Waste category, or UNCLASSIFIED for reports without one',
  })
  @IsOptional()
  @IsIn(REPORT_CATEGORY_FILTERS)
  category?: ReportCategoryFilter;

  @ApiPropertyOptional({ description: 'Inclusive start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Inclusive end date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Reporter id (admin scope only)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  reporterId?: number;
}
