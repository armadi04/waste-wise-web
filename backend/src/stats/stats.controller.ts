import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { StatsService } from './stats.service';

@ApiTags('Stats')
@ApiBearerAuth()
@Controller('stats')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @Permissions('stats.read')
  @ApiOperation({ summary: 'Counters for the dashboard' })
  @ApiResponse({ status: 200 })
  overview() {
    return this.statsService.overview();
  }

  @Get('signups')
  @Permissions('stats.read')
  @ApiOperation({ summary: 'Accounts created per day' })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiResponse({ status: 200 })
  signups(@Query('days') days?: string, @Query('timeZone') timeZone?: string) {
    const parsed = Number(days);
    const window = Number.isFinite(parsed)
      ? Math.min(90, Math.max(7, parsed))
      : 30;
    return this.statsService.signupsTrend(window, timeZone);
  }
}
