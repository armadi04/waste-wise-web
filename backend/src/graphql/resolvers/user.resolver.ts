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
import { OwnerOrPermissionGuard } from '@/auth/owner-or-permission.guard';
import { Permissions } from '@/auth/permissions.decorator';
import { UsersService } from '@/users/users.service';
import { UpdateUserDto } from '@/users/dto/update-user.dto';
import { User } from '@/users/entities/user.entity';
import { GqlCurrentUser } from '../decorators/gql-current-user.decorator';
import type { AuthenticatedUser } from '@/auth/interfaces/auth-request.interface';
import type { PaginationInput } from '../generated/graphql';
import type { IGraphQLContext } from '../dataloaders/dataloader.types';
import { paginationArgs } from '../helpers/pagination.util';

/**
 * GraphQL surface for users. Reuses {@link UsersService} and the same `users.*`
 * authorization strings as the REST controller. Auth is JWT at the class level;
 * each operation adds PermissionsGuard, or OwnerOrPermissionGuard where a user
 * may act on their own record (read/update).
 */
@Resolver('User')
@UseGuards(JwtAuthGuard)
export class UserResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query('users')
  @UseGuards(PermissionsGuard)
  @Permissions('users.read')
  findAll(@Args('pagination') pagination?: PaginationInput) {
    return this.usersService.findAllPaginated(...paginationArgs(pagination));
  }

  @Query('user')
  @UseGuards(OwnerOrPermissionGuard)
  @Permissions('users.read')
  findOne(@Args('id') id: number) {
    return this.usersService.findOne(id);
  }

  @Mutation('updateUser')
  @UseGuards(OwnerOrPermissionGuard)
  @Permissions('users.update')
  update(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('id') id: number,
    @Args('input') input: UpdateUserDto,
  ) {
    // OwnerOrPermissionGuard lets a user update their own record; the
    // field-level rules are shared with REST in UsersService.updateAs.
    return this.usersService.updateAs(currentUser, id, input);
  }

  @Mutation('deleteUser')
  @UseGuards(PermissionsGuard)
  @Permissions('users.delete')
  async remove(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('id') id: number,
  ): Promise<boolean> {
    await this.usersService.assertCanManage(currentUser, id);
    await this.usersService.remove(id);
    return true;
  }

  @Mutation('syncUserRoles')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage_roles')
  async syncRoles(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('id') id: number,
    @Args('roleIds') roleIds: number[],
  ) {
    await this.usersService.assertCanManage(currentUser, id, { roleIds });
    await this.usersService.syncRoles(id, roleIds);
    return this.usersService.findOne(id);
  }

  @Mutation('attachUserRoles')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage_roles')
  async attachRoles(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('id') id: number,
    @Args('roleIds') roleIds: number[],
  ) {
    await this.usersService.assertCanManage(currentUser, id, { roleIds });
    await this.usersService.attachRoles(id, roleIds);
    return this.usersService.findOne(id);
  }

  @Mutation('detachUserRoles')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage_roles')
  async detachRoles(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('id') id: number,
    @Args('roleIds') roleIds: number[],
  ) {
    await this.usersService.assertCanManage(currentUser, id);
    await this.usersService.detachRoles(id, roleIds);
    return this.usersService.findOne(id);
  }

  @Mutation('syncUserPermissions')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage_permissions')
  async syncPermissions(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('id') id: number,
    @Args('permissionIds') permissionIds: number[],
  ) {
    await this.usersService.assertCanManage(currentUser, id, { permissionIds });
    await this.usersService.syncPermissions(id, permissionIds);
    return this.usersService.findOne(id);
  }

  @Mutation('attachUserPermissions')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage_permissions')
  async attachPermissions(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('id') id: number,
    @Args('permissionIds') permissionIds: number[],
  ) {
    await this.usersService.assertCanManage(currentUser, id, { permissionIds });
    await this.usersService.attachPermissions(id, permissionIds);
    return this.usersService.findOne(id);
  }

  @Mutation('detachUserPermissions')
  @UseGuards(PermissionsGuard)
  @Permissions('users.manage_permissions')
  async detachPermissions(
    @GqlCurrentUser() currentUser: AuthenticatedUser,
    @Args('id') id: number,
    @Args('permissionIds') permissionIds: number[],
  ) {
    await this.usersService.assertCanManage(currentUser, id);
    await this.usersService.detachPermissions(id, permissionIds);
    return this.usersService.findOne(id);
  }

  /** Relations fall back to per-request DataLoaders when not eager-loaded. */
  @ResolveField('roles')
  roles(@Parent() user: User, @Context() ctx: IGraphQLContext) {
    return user.roles ?? ctx.loaders.userRoles.load(user.id);
  }

  @ResolveField('permissions')
  userPermissions(@Parent() user: User, @Context() ctx: IGraphQLContext) {
    return user.permissions ?? ctx.loaders.userPermissions.load(user.id);
  }

  @ResolveField('avatar')
  avatar(@Parent() user: User) {
    return user.avatar ?? null;
  }
}
