import {
  ClassSerializerInterceptor,
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PaginationParamsDto } from '../common/dto/pagination-params.dto';
import { PaginatedResponseDto } from '../common/services/base.service';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

class AuditQueryDto extends PaginationParamsDto {
  @ApiPropertyOptional({ description: 'Restrict to a single action' })
  @IsOptional()
  @IsString()
  action?: string;
}

class PaginatedAuditResponse extends PaginatedResponseDto<AuditLog> {
  @ApiProperty({ type: [AuditLog] })
  declare data: AuditLog[];
}

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions('audit.read')
  @ApiOperation({ summary: 'Read the audit trail' })
  @ApiResponse({ status: 200, type: PaginatedAuditResponse })
  findAll(@Query() params: AuditQueryDto) {
    return this.auditService.findAllPaginated(
      params.page || 1,
      params.limit || 20,
      params.search,
      params.sort || 'createdAt',
      params.direction,
      params.action,
    );
  }

  @Get('actions')
  @Permissions('audit.read')
  @ApiOperation({ summary: 'The distinct actions recorded so far' })
  @ApiResponse({ status: 200, type: [String] })
  findActions() {
    return this.auditService.findActions();
  }
}
