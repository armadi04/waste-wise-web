import { UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { Permissions } from '@/auth/permissions.decorator';
import { RolesService } from '@/roles/roles.service';
import { CreateRoleDto } from '@/roles/dto/create-role.dto';
import { UpdateRoleDto } from '@/roles/dto/update-role.dto';
import { Role } from '@/roles/entities/role.entity';
import type { PaginationInput } from '../generated/graphql';
import type { IGraphQLContext } from '../dataloaders/dataloader.types';
import { paginationArgs } from '../helpers/pagination.util';
import { GqlCurrentUser } from '../decorators/gql-current-user.decorator';
import type { AuthenticatedUser } from '@/auth/interfaces/auth-request.interface';

/**
 * GraphQL surface for roles. Reuses {@link RolesService} and the same `roles.*`
 * authorization strings as the REST controller.
 */
@Resolver('Role')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoleResolver {
  constructor(private readonly rolesService: RolesService) {}

  @Query('roles')
  @Permissions('roles.read')
  findAll(@Args('pagination') pagination?: PaginationInput) {
    return this.rolesService.findAllPaginated(...paginationArgs(pagination));
  }

  @Query('role')
  @Permissions('roles.read')
  findOne(@Args('id') id: number) {
    return this.rolesService.findOne(id);
  }

  @Mutation('createRole')
  @Permissions('roles.create')
  async create(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('input') input: CreateRoleDto,
  ) {
    await this.rolesService.assertCanWrite(currentUser, null, {
      name: input.name,
      permissionIds: input.permissions,
    });
    return this.rolesService.createRole(input);
  }

  @Mutation('updateRole')
  @Permissions('roles.update')
  async update(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('id') id: number,
    @Args('input') input: UpdateRoleDto,
  ) {
    await this.rolesService.assertCanWrite(currentUser, id, {
      name: input.name,
      permissionIds: input.permissions,
    });
    return this.rolesService.updateRole(id, input);
  }

  @Mutation('deleteRole')
  @Permissions('roles.delete')
  async remove(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('id') id: number,
  ): Promise<boolean> {
    await this.rolesService.assertCanDelete(currentUser, [id]);
    await this.rolesService.remove(id);
    return true;
  }

  @Mutation('syncRolePermissions')
  @Permissions('roles.manage_permissions')
  async syncPermissions(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('id') id: number,
    @Args('permissionIds') permissionIds: number[],
  ) {
    await this.rolesService.assertCanWrite(currentUser, id, { permissionIds });
    await this.rolesService.syncPermissions(id, permissionIds);
    return this.rolesService.findOne(id);
  }

  @Mutation('attachRolePermissions')
  @Permissions('roles.manage_permissions')
  async attachPermissions(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('id') id: number,
    @Args('permissionIds') permissionIds: number[],
  ) {
    await this.rolesService.assertCanWrite(currentUser, id, { permissionIds });
    await this.rolesService.attachPermissions(id, permissionIds);
    return this.rolesService.findOne(id);
  }

  @Mutation('detachRolePermissions')
  @Permissions('roles.manage_permissions')
  async detachPermissions(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('id') id: number,
    @Args('permissionIds') permissionIds: number[],
  ) {
    await this.rolesService.assertCanWrite(currentUser, id);
    await this.rolesService.detachPermissions(id, permissionIds);
    return this.rolesService.findOne(id);
  }

  /** Uses the relation already loaded by the service, else batches via loader. */
  @ResolveField('permissions')
  permissions(@Parent() role: Role, @Context() ctx: IGraphQLContext) {
    return role.permissions ?? ctx.loaders.rolePermissions.load(role.id);
  }
}
