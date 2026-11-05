import { ApiProperty } from '@nestjs/swagger';
import { Report } from '../entities/report.entity';

export class ReportCategoryCountsDto {
  @ApiProperty()
  organic: number;

  @ApiProperty()
  plastic: number;

  @ApiProperty()
  paper: number;

  @ApiProperty()
  unclassified: number;
}

export class ReportStatsDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  pending: number;

  @ApiProperty()
  inProgress: number;

  @ApiProperty()
  completed: number;

  @ApiProperty()
  rejected: number;

  @ApiProperty({ type: ReportCategoryCountsDto })
  byCategory: ReportCategoryCountsDto;

  @ApiProperty({ type: [Report] })
  recentReports: Report[];
}
