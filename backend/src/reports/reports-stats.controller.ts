import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import type { IAuthRequest } from '../auth/interfaces/auth-request.interface';
import { ReportStatsDto } from './dto/report-stats.dto';
import { ReportsService } from './reports.service';

@ApiTags('Stats')
@ApiBearerAuth()
@Controller('stats')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsStatsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('reports')
  @Permissions('reports.read.all', 'reports.read.own')
  @ApiOperation({ summary: 'Report statistics scoped to the current user' })
  @ApiResponse({ status: 200, type: ReportStatsDto })
  reports(@Req() req: IAuthRequest) {
    return this.reportsService.statsForActor(req.user);
  }
}
