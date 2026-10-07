import {
  Req,
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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ManagePermissionsDto } from './dto/manage-permissions.dto';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { CacheService } from '../common/cache/cache.service';
import { PaginationParamsDto } from '../common/dto/pagination-params.dto';
import { BulkDeleteDto } from '../common/dto/bulk-delete.dto';
import { Role } from './entities/role.entity';
import { PaginatedResponseDto } from '../common/services/base.service';
import type { IAuthRequest } from '../auth/interfaces/auth-request.interface';

class PaginatedRoleResponse extends PaginatedResponseDto<Role> {
  @ApiProperty({ type: [Role] })
  declare data: Role[];
}

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly cacheService: CacheService,
  ) {}

  @Post()
  @Permissions('roles.create')
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, type: Role })
  @UseInterceptors(NoFilesInterceptor())
  async create(@Req() req: IAuthRequest, @Body() createRoleDto: CreateRoleDto) {
    await this.rolesService.assertCanWrite(req.user, null, {
      name: createRoleDto.name,
      permissionIds: createRoleDto.permissions,
    });
    const result = await this.rolesService.createRole(createRoleDto);
    await this.clearRoleCaches();
    return result;
  }

  @Get()
  @Permissions('roles.read')
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({ status: 200, type: PaginatedRoleResponse })
  @UseInterceptors(CacheInterceptor)
  findAll(@Query() params: PaginationParamsDto) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    if (params.paginated) {
      return this.rolesService.findAllPaginated(
        page,
        limit,
        params.search,
        params.sort,
        params.direction,
      );
    }
    return this.rolesService.findAll();
  }

  @Get(':id')
  @Permissions('roles.read')
  @ApiOperation({ summary: 'Get a role by ID' })
  @ApiResponse({ status: 200, type: Role })
  @UseInterceptors(CacheInterceptor)
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(+id);
  }

  @Patch(':id')
  @Permissions('roles.update')
  @ApiOperation({ summary: 'Update a role' })
  @ApiResponse({ status: 200, type: Role })
  @UseInterceptors(NoFilesInterceptor())
  async update(
    @Req() req: IAuthRequest,
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    await this.rolesService.assertCanWrite(req.user, +id, {
      name: updateRoleDto.name,
      permissionIds: updateRoleDto.permissions,
    });
    const result = await this.rolesService.updateRole(+id, updateRoleDto);
    await this.clearRoleCaches();
    return result;
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('roles.delete')
  @ApiOperation({ summary: 'Delete multiple roles' })
  @ApiResponse({ status: 200 })
  async bulkRemove(@Req() req: IAuthRequest, @Body() dto: BulkDeleteDto) {
    await this.rolesService.assertCanDelete(req.user, dto.ids);
    const result = await this.rolesService.removeMany(dto.ids);
    await this.clearRoleCaches();
    return result;
  }

  @Delete(':id')
  @Permissions('roles.delete')
  @ApiOperation({ summary: 'Delete a role' })
  @ApiResponse({ status: 200 })
  async remove(@Req() req: IAuthRequest, @Param('id') id: string) {
    await this.rolesService.assertCanDelete(req.user, [+id]);
    const result = await this.rolesService.remove(+id);
    await this.clearRoleCaches();
    return result;
  }

  @Post(':id/permissions/sync')
  @Permissions('roles.manage_permissions')
  @ApiOperation({ summary: 'Sync role permissions' })
  @ApiResponse({ status: 200, type: Role })
  @UseInterceptors(NoFilesInterceptor())
  async syncPermissions(
    @Req() req: IAuthRequest,
    @Param('id') id: string,
    @Body() dto: ManagePermissionsDto,
  ) {
    await this.rolesService.assertCanWrite(req.user, +id, {
      permissionIds: dto.permissions,
    });
    const result = await this.rolesService.syncPermissions(
      +id,
      dto.permissions,
    );
    await this.clearRoleCaches();
    return result;
  }

  @Post(':id/permissions/attach')
  @Permissions('roles.manage_permissions')
  @ApiOperation({ summary: 'Attach permissions to role' })
  @ApiResponse({ status: 200, type: Role })
  @UseInterceptors(NoFilesInterceptor())
  async attachPermissions(
    @Req() req: IAuthRequest,
    @Param('id') id: string,
    @Body() dto: ManagePermissionsDto,
  ) {
    await this.rolesService.assertCanWrite(req.user, +id, {
      permissionIds: dto.permissions,
    });
    const result = await this.rolesService.attachPermissions(
      +id,
      dto.permissions,
    );
    await this.clearRoleCaches();
    return result;
  }

  @Post(':id/permissions/detach')
  @Permissions('roles.manage_permissions')
  @ApiOperation({ summary: 'Detach permissions from role' })
  @ApiResponse({ status: 200, type: Role })
  @UseInterceptors(NoFilesInterceptor())
  async detachPermissions(
    @Req() req: IAuthRequest,
    @Param('id') id: string,
    @Body() dto: ManagePermissionsDto,
  ) {
    await this.rolesService.assertCanWrite(req.user, +id);
    const result = await this.rolesService.detachPermissions(
      +id,
      dto.permissions,
    );
    await this.clearRoleCaches();
    return result;
  }

  // User responses embed roles with their permissions.
  private async clearRoleCaches() {
    await this.cacheService.clearKeys('*/roles*');
    await this.cacheService.clearKeys('*/users*');
  }
}
