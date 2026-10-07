import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { Permissions } from '@/auth/permissions.decorator';
import { PermissionsService } from '@/permissions/permissions.service';
import { CreatePermissionDto } from '@/permissions/dto/create-permission.dto';
import { UpdatePermissionDto } from '@/permissions/dto/update-permission.dto';
import type { PaginationInput } from '../generated/graphql';
import { paginationArgs } from '../helpers/pagination.util';

/**
 * GraphQL surface for permissions. Thin wrapper over {@link PermissionsService}
 * reusing the exact `permissions.*` authorization strings as the REST controller.
 */
@Resolver('Permission')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionResolver {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Query('permissions')
  @Permissions('permissions.read')
  findAll(@Args('pagination') pagination?: PaginationInput) {
    return this.permissionsService.findAllPaginated(
      ...paginationArgs(pagination),
    );
  }

  @Query('permission')
  @Permissions('permissions.read')
  findOne(@Args('id') id: number) {
    return this.permissionsService.findOne(id);
  }

  @Mutation('createPermission')
  @Permissions('permissions.create')
  create(@Args('input') input: CreatePermissionDto) {
    return this.permissionsService.create(input);
  }

  @Mutation('updatePermission')
  @Permissions('permissions.update')
  update(@Args('id') id: number, @Args('input') input: UpdatePermissionDto) {
    return this.permissionsService.update(id, input);
  }

  @Mutation('deletePermission')
  @Permissions('permissions.delete')
  async remove(@Args('id') id: number): Promise<boolean> {
    await this.permissionsService.remove(id);
    return true;
  }
}
