import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationParamsDto } from '@/common/dto/pagination-params.dto';
import { ReportStatus, WasteCategory } from '../entities/report.entity';

export class ReportQueryDto extends PaginationParamsDto {
  @ApiPropertyOptional({ enum: ReportStatus })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional({ enum: WasteCategory })
  @IsOptional()
  @IsEnum(WasteCategory)
  category?: WasteCategory;

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
