import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiProperty,
} from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { NoFilesInterceptor } from '@nestjs/platform-fastify/multipart';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { CacheService } from '../common/cache/cache.service';
import { PaginationParamsDto } from '../common/dto/pagination-params.dto';
import { BulkDeleteDto } from '../common/dto/bulk-delete.dto';
import { Permission } from './entities/permission.entity';
import { PaginatedResponseDto } from '../common/services/base.service';

class PaginatedPermissionResponse extends PaginatedResponseDto<Permission> {
  @ApiProperty({ type: [Permission] })
  declare data: Permission[];
}

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly cacheService: CacheService,
  ) {}

  @Post()
  @Permissions('permissions.create')
  @ApiOperation({ summary: 'Create a new permission' })
  @ApiResponse({ status: 201, type: Permission })
  @UseInterceptors(NoFilesInterceptor())
  async create(@Body() createPermissionDto: CreatePermissionDto) {
    const result = await this.permissionsService.create(createPermissionDto);
    await this.clearPermissionCaches();
    return result;
  }

  @Get()
  @Permissions('permissions.read')
  @ApiOperation({ summary: 'Get all permissions' })
  @ApiResponse({ status: 200, type: PaginatedPermissionResponse })
  @UseInterceptors(CacheInterceptor)
  findAll(@Query() params: PaginationParamsDto) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    if (params.paginated) {
      return this.permissionsService.findAllPaginated(
        page,
        limit,
        params.search,
        params.sort,
        params.direction,
      );
    }
    return this.permissionsService.findAll();
  }

  @Get(':id')
  @Permissions('permissions.read')
  @ApiOperation({ summary: 'Get a permission by ID' })
  @ApiResponse({ status: 200, type: Permission })
  @UseInterceptors(CacheInterceptor)
  findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(+id);
  }

  @Patch(':id')
  @Permissions('permissions.update')
  @ApiOperation({ summary: 'Update a permission' })
  @ApiResponse({ status: 200, type: Permission })
  @UseInterceptors(NoFilesInterceptor())
  async update(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    const result = await this.permissionsService.update(
      +id,
      updatePermissionDto,
    );
    await this.clearPermissionCaches();
    return result;
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('permissions.delete')
  @ApiOperation({ summary: 'Delete multiple permissions' })
  @ApiResponse({ status: 200 })
  async bulkRemove(@Body() dto: BulkDeleteDto) {
    const result = await this.permissionsService.removeMany(dto.ids);
    await this.clearPermissionCaches();
    return result;
  }

  @Delete(':id')
  @Permissions('permissions.delete')
  @ApiOperation({ summary: 'Delete a permission' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id') id: string) {
    const result = await this.permissionsService.remove(+id);
    await this.clearPermissionCaches();
    return result;
  }

  // Role and user responses embed permissions.
  private async clearPermissionCaches() {
    await this.cacheService.clearKeys('*/permissions*');
    await this.cacheService.clearKeys('*/roles*');
    await this.cacheService.clearKeys('*/users*');
  }
}
