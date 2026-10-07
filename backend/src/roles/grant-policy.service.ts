import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import type { AuthenticatedUser } from '../auth/interfaces/auth-request.interface';

export const SUPERADMIN_ROLE = 'superadmin';

type NamedRole = Pick<Role, 'name'>;

/**
 * The "you can only hand out what you hold" rule for every route that grants
 * access: assigning roles or direct permissions to users, putting permissions
 * into roles, and inviting with roles. Without it any of those permissions
 * would be a way for a limited admin to give themselves (or an accomplice)
 * a superadmin's access.
 *
 * Only additions are checked: an admin may still save a user or role that
 * already holds something they don't, as long as they don't add to it.
 * The superadmin role and superadmin accounts are managed by superadmins only.
 */
@Injectable()
export class GrantPolicyService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  isSuperadmin(actor: AuthenticatedUser): boolean {
    return actor.roles?.includes(SUPERADMIN_ROLE) ?? false;
  }

  /** For optional body fields that need a stronger permission than the route's own. */
  requirePermission(actor: AuthenticatedUser, permission: string) {
    if (this.isSuperadmin(actor) || actor.permissions?.includes(permission))
      return;
    throw new ForbiddenException(
      `This change needs the ${permission} permission`,
    );
  }

  async assertCanGrantRoles(
    actor: AuthenticatedUser,
    roleIds: number[],
    alreadyHeld: number[] = [],
  ) {
    if (this.isSuperadmin(actor)) return;
    const added = roleIds.filter((id) => !alreadyHeld.includes(id));
    if (added.length === 0) return;
    const roles = await this.roleRepository.find({
      where: { id: In(added) },
      relations: { permissions: true },
    });
    if (roles.some((role) => role.name === SUPERADMIN_ROLE)) {
      throw new ForbiddenException(
        'Only a superadmin can grant the superadmin role',
      );
    }
    this.assertHolds(
      actor,
      roles.flatMap((role) => role.permissions?.map((p) => p.name) ?? []),
    );
  }

  async assertCanGrantPermissions(
    actor: AuthenticatedUser,
    permissionIds: number[],
    alreadyHeld: number[] = [],
  ) {
    if (this.isSuperadmin(actor)) return;
    const added = permissionIds.filter((id) => !alreadyHeld.includes(id));
    if (added.length === 0) return;
    const permissions = await this.permissionRepository.findBy({
      id: In(added),
    });
    this.assertHolds(
      actor,
      permissions.map((p) => p.name),
    );
  }

  /** Superadmin accounts can be edited, deleted or re-roled by superadmins only. */
  assertCanManageAccount(
    actor: AuthenticatedUser,
    target: { roles?: NamedRole[] },
  ) {
    if (this.isSuperadmin(actor)) return;
    if (target.roles?.some((role) => role.name === SUPERADMIN_ROLE)) {
      throw new ForbiddenException(
        'Only a superadmin can change a superadmin account',
      );
    }
  }

  /** The superadmin role itself can be renamed, edited or deleted by superadmins only. */
  assertCanChangeRole(actor: AuthenticatedUser, role: NamedRole) {
    if (this.isSuperadmin(actor)) return;
    if (role.name === SUPERADMIN_ROLE) {
      throw new ForbiddenException(
        'Only a superadmin can change the superadmin role',
      );
    }
  }

  private assertHolds(actor: AuthenticatedUser, granted: string[]) {
    const held = new Set(actor.permissions ?? []);
    const notHeld = [...new Set(granted)].filter((name) => !held.has(name));
    if (notHeld.length > 0) {
      throw new ForbiddenException(
        `You cannot grant permissions you do not have: ${notHeld.join(', ')}`,
      );
    }
  }
}
