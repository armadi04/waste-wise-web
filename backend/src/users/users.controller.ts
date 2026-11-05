import type { UploadedMultipartFile } from '@nestjs/platform-fastify/multipart';
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
  ClassSerializerInterceptor,
  UploadedFile,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiProperty,
} from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ManageRolesDto } from './dto/manage-roles.dto';
import { ManageUserPermissionsDto } from './dto/manage-user-permissions.dto';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { OwnerOrPermissionGuard } from '../auth/owner-or-permission.guard';
import {
  FileInterceptor,
  NoFilesInterceptor,
} from '@nestjs/platform-fastify/multipart';
import { MediaService } from '../media/media.service';
import { MediaUploadAdmissionInterceptor } from '../media/media-upload-admission.interceptor';
import { CacheService } from '../common/cache/cache.service';
import { CacheInterceptor } from '@nestjs/cache-manager';
import type { IAuthRequest } from '../auth/interfaces/auth-request.interface';
import { UsersQueryDto } from './dto/users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { BulkDeleteDto } from '../common/dto/bulk-delete.dto';
import { User } from './entities/user.entity';
import { PaginatedResponseDto } from '../common/services/base.service';

class PaginatedUserResponse extends PaginatedResponseDto<User> {
  @ApiProperty({ type: [User] })
  declare data: User[];
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mediaService: MediaService,
    private readonly cacheService: CacheService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** One place for the "who changed what about whom" entries this controller writes. */
  private recordAudit(
    req: IAuthRequest,
    action: string,
    subjectId: number,
    summary: string,
    metadata?: Record<string, unknown>,
  ) {
    this.eventEmitter.emit('audit.record', {
      action,
      actorId: req.user.userId,
      actorEmail: req.user.email,
      subjectType: 'user',
      subjectId,
      summary,
      metadata,
      ipAddress: req.ip ?? null,
    });
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('users.read')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, type: PaginatedUserResponse })
  @UseInterceptors(CacheInterceptor)
  findAll(@Query() params: UsersQueryDto) {
    return this.usersService.listUsers(params);
  }

  @Patch(':id')
  @UseGuards(OwnerOrPermissionGuard)
  @Permissions('users.update')
  @ApiOperation({ summary: 'Update a user' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, type: User })
  @UseInterceptors(MediaUploadAdmissionInterceptor, FileInterceptor('avatar'))
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: IAuthRequest,
    @UploadedFile() file?: UploadedMultipartFile,
  ) {
    // Field-level rules (owners can't change their own access or email,
    // access fields need manage_* and may only grant what the caller holds)
    // live in UsersService.updateAs so GraphQL enforces the same ones.
    if (file) {
      const media = await this.mediaService.uploadFile(
        file,
        req.user.userId,
        true,
      );
      updateUserDto.avatarId = media.id;
    }
    const result = await this.usersService.updateAs(
      req.user,
      +id,
      updateUserDto,
    );
    await this.cacheService.clearKeys('*/users*');
    if (
      req.user.userId !== +id &&
      (updateUserDto.roleIds || updateUserDto.permissionIds)
    ) {
      this.recordAudit(
        req,
        'user.access_updated',
        +id,
        `Changed the access of user #${id}`,
        {
          roleIds: updateUserDto.roleIds,
          permissionIds: updateUserDto.permissionIds,
        },
      );
    }
    return result;
  }

  @Get(':id')
  @UseGuards(OwnerOrPermissionGuard)
  @Permissions('users.read')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({ status: 200, type: User })
  @UseInterceptors(CacheInterceptor)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PermissionsGuard)
  @Permissions('users.delete')
  @ApiOperation({ summary: 'Delete multiple users' })
  @ApiResponse({ status: 200 })
  async bulkRemove(@Req() req: IAuthRequest, @Body() dto: BulkDeleteDto) {
    await this.usersService.assertCanManageMany(req.user, dto.ids);
    const result = await this.usersService.removeMany(dto.ids);
    await this.cacheService.clearKeys('*/users*');
    return result;
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('users.delete')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200 })
  async remove(@Req() req: IAuthRequest, @Param('id') id: string) {
    await this.usersService.assertCanManage(req.user, +id);
    const result = await this.usersService.remove(+id);
    await this.cacheService.clearKeys('*/users*');
    this.recordAudit(req, 'user.deleted', +id, `Deleted user #${id}`);
    return result;
  }

  @Patch(':id/status')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage_status')
  @ApiOperation({ summary: 'Activate or deactivate a user account' })
  @ApiResponse({ status: 200, type: User })
  @UseInterceptors(NoFilesInterceptor())
  async updateStatus(
    @Req() req: IAuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.setActiveAs(
      req.user,
      +id,
      dto.isActive,
      req.ip ?? null,
    );
  }

  // Role Management Endpoints
  @Post(':id/roles/sync')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage_roles')
  @ApiOperation({ summary: 'Sync user roles' })
  @ApiResponse({ status: 200, type: User })
  @UseInterceptors(NoFilesInterceptor())
  async syncRoles(
    @Req() req: IAuthRequest,
    @Param('id') id: string,
    @Body() dto: ManageRolesDto,
  ) {
    await this.usersService.assertCanManage(req.user, +id, {
      roleIds: dto.roles,
    });
    const result = await this.usersService.syncRoles(+id, dto.roles);
    await this.cacheService.clearKeys('*/users*');
    this.recordAudit(
      req,
      'user.roles_synced',
      +id,
      `Set the roles of user #${id}`,
      {
        roles: dto.roles,
      },
    );
    return result;
  }

  @Post(':id/roles/attach')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage_roles')
  @ApiOperation({ summary: 'Attach roles to user' })
  @ApiResponse({ status: 200, type: User })
  @UseInterceptors(NoFilesInterceptor())
  async attachRoles(
    @Req() req: IAuthRequest,
    @Param('id') id: string,
    @Body() dto: ManageRolesDto,
  ) {
    await this.usersService.assertCanManage(req.user, +id, {
      roleIds: dto.roles,
    });
    const result = await this.usersService.attachRoles(+id, dto.roles);
    await this.cacheService.clearKeys('*/users*');
    return result;
  }

  @Post(':id/roles/detach')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage_roles')
  @ApiOperation({ summary: 'Detach roles from user' })
  @ApiResponse({ status: 200, type: User })
  @UseInterceptors(NoFilesInterceptor())
  async detachRoles(
    @Req() req: IAuthRequest,
    @Param('id') id: string,
    @Body() dto: ManageRolesDto,
  ) {
    await this.usersService.assertCanManage(req.user, +id);
    const result = await this.usersService.detachRoles(+id, dto.roles);
    await this.cacheService.clearKeys('*/users*');
    return result;
  }

  // Permission Management Endpoints
  @Post(':id/permissions/sync')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage_permissions')
  @ApiOperation({ summary: 'Sync user permissions' })
  @ApiResponse({ status: 200, type: User })
  @UseInterceptors(NoFilesInterceptor())
  async syncPermissions(
    @Req() req: IAuthRequest,
    @Param('id') id: string,
    @Body() dto: ManageUserPermissionsDto,
  ) {
    await this.usersService.assertCanManage(req.user, +id, {
      permissionIds: dto.permissions,
    });
    const result = await this.usersService.syncPermissions(
      +id,
      dto.permissions,
    );
    await this.cacheService.clearKeys('*/users*');
    this.recordAudit(
      req,
      'user.permissions_synced',
      +id,
      `Set the direct permissions of user #${id}`,
      { permissions: dto.permissions },
    );
    return result;
  }

  @Post(':id/permissions/attach')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage_permissions')
  @ApiOperation({ summary: 'Attach permissions to user' })
  @ApiResponse({ status: 200, type: User })
  @UseInterceptors(NoFilesInterceptor())
  async attachPermissions(
    @Req() req: IAuthRequest,
    @Param('id') id: string,
    @Body() dto: ManageUserPermissionsDto,
  ) {
    await this.usersService.assertCanManage(req.user, +id, {
      permissionIds: dto.permissions,
    });
    const result = await this.usersService.attachPermissions(
      +id,
      dto.permissions,
    );
    await this.cacheService.clearKeys('*/users*');
    return result;
  }

  @Post(':id/permissions/detach')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage_permissions')
  @ApiOperation({ summary: 'Detach permissions from user' })
  @ApiResponse({ status: 200, type: User })
  @UseInterceptors(NoFilesInterceptor())
  async detachPermissions(
    @Req() req: IAuthRequest,
    @Param('id') id: string,
    @Body() dto: ManageUserPermissionsDto,
  ) {
    await this.usersService.assertCanManage(req.user, +id);
    const result = await this.usersService.detachPermissions(
      +id,
      dto.permissions,
    );
    await this.cacheService.clearKeys('*/users*');
    return result;
  }
}
