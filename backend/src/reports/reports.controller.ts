import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NoFilesInterceptor } from '@nestjs/platform-fastify/multipart';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import type { IAuthRequest } from '../auth/interfaces/auth-request.interface';
import { PaginatedResponseDto } from '../common/services/base.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { Report } from './entities/report.entity';
import { ReportsService } from './reports.service';

class PaginatedReportResponse extends PaginatedResponseDto<Report> {
  @ApiProperty({ type: [Report] })
  declare data: Report[];
}

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @Permissions('reports.read.all', 'reports.read.own')
  @ApiOperation({ summary: 'List reports visible to the current user' })
  @ApiResponse({ status: 200, type: PaginatedReportResponse })
  findAll(@Req() req: IAuthRequest, @Query() query: ReportQueryDto) {
    return this.reportsService.listReports(req.user, query);
  }

  @Get(':id')
  @Permissions('reports.read.all', 'reports.read.own')
  @ApiOperation({ summary: 'Get a report by ID' })
  @ApiResponse({ status: 200, type: Report })
  findOne(@Req() req: IAuthRequest, @Param('id', ParseIntPipe) id: number) {
    return this.reportsService.findOneForActor(req.user, id);
  }

  @Post()
  @Permissions('reports.create')
  @ApiOperation({ summary: 'Create a report' })
  @ApiResponse({ status: 201, type: Report })
  @UseInterceptors(NoFilesInterceptor())
  create(@Req() req: IAuthRequest, @Body() dto: CreateReportDto) {
    return this.reportsService.createForActor(req.user, dto);
  }

  @Patch(':id')
  @Permissions('reports.update.all', 'reports.update.own')
  @ApiOperation({ summary: 'Update a report' })
  @ApiResponse({ status: 200, type: Report })
  @UseInterceptors(NoFilesInterceptor())
  update(
    @Req() req: IAuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReportDto,
  ) {
    return this.reportsService.updateForActor(req.user, id, dto);
  }

  @Patch(':id/status')
  @Permissions('reports.status.update')
  @ApiOperation({ summary: 'Update report handling status' })
  @ApiResponse({ status: 200, type: Report })
  @UseInterceptors(NoFilesInterceptor())
  updateStatus(
    @Req() req: IAuthRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatusForActor(req.user, id, dto.status);
  }

  @Delete(':id')
  @Permissions('reports.delete.all', 'reports.delete.own')
  @ApiOperation({ summary: 'Soft-delete a report' })
  @ApiResponse({ status: 200 })
  async remove(
    @Req() req: IAuthRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.reportsService.removeForActor(req.user, id);
    return { deleted: true };
  }
}
