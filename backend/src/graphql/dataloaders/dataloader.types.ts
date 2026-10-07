import type DataLoader from 'dataloader';
import type { Request, Response } from 'express';
import type { Role } from '@/roles/entities/role.entity';
import type { Permission } from '@/permissions/entities/permission.entity';
import type { User } from '@/users/entities/user.entity';

/**
 * Per-request DataLoaders. Each batches lookups of a relation by the parent
 * entity's id so a query resolving N parents issues one DB round-trip per
 * relation instead of N (the classic GraphQL N+1).
 */
export interface IDataLoaders {
  /** Roles for a user id (User.roles). */
  userRoles: DataLoader<number, Role[]>;
  /** Direct permissions for a user id (User.permissions). */
  userPermissions: DataLoader<number, Permission[]>;
  /** Permissions for a role id (Role.permissions). */
  rolePermissions: DataLoader<number, Permission[]>;
  /** A user by id (Media.user, Notification.user). */
  userById: DataLoader<number, User | null>;
}

/** Shape of the Apollo context exposed to guards and resolvers. */
export interface IGraphQLContext {
  req: Request;
  res: Response;
  loaders: IDataLoaders;
}
