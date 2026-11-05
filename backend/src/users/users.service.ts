import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  In,
  Raw,
  IsNull,
  Not,
  type FindOptionsWhere,
} from 'typeorm';
import { RegisterMethodEnum } from './register-method.enum';
import type { UsersQueryDto } from './dto/users-query.dto';
import { createdInRange } from '@/common/helpers/created-in-range';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { Role } from '../roles/entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { Media } from '../media/entities/media.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BaseService } from '../common/services/base.service';
import { GrantPolicyService } from '../roles/grant-policy.service';
import type { AuthenticatedUser } from '../auth/interfaces/auth-request.interface';
import { SessionsService } from '../sessions/sessions.service';
import type { AccountStatus } from './account-status';
import { presentUser, presentUsers } from './user.presenter';
import type { UserStatusUpdatedEvent } from './user-events';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class UsersService extends BaseService<User> {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionsRepository: Repository<Permission>,
    @InjectRepository(Media)
    private mediaRepository: Repository<Media>,
    private readonly grantPolicy: GrantPolicyService,
    private readonly sessionsService: SessionsService,
  ) {
    super(usersRepository, 'User', ['email', 'fullname']);
  }

  /** Live account for an email, matched case-insensitively (UQ_users_email_active). */
  async findOneByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: {
        email: Raw((column) => `LOWER(${column}) = LOWER(:email)`, {
          email: email.trim(),
        }),
      },
      relations: {
        roles: { permissions: true },
        permissions: true,
        avatar: true,
      },
    });
  }

  override async create(
    userData: CreateUserDto,
    options?: { autoVerify?: boolean; registerMethod?: RegisterMethodEnum },
  ): Promise<User> {
    const password = userData.password;
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = this.usersRepository.create({
      ...userData,
      email: normalizeEmail(userData.email),
      password: hashedPassword,
      registerMethod: options?.registerMethod ?? RegisterMethodEnum.UNKNOWN,
    });

    if (options?.autoVerify) {
      newUser.emailVerifiedAt = new Date();
    }

    if (userData.roleIds) {
      const roles = await this.rolesRepository.findBy({
        id: In(userData.roleIds),
      });
      newUser.roles = roles;
    }

    if (userData.permissionIds) {
      const permissions = await this.permissionsRepository.findBy({
        id: In(userData.permissionIds),
      });
      newUser.permissions = permissions;
    }

    if (userData.avatarId) {
      const media = await this.mediaRepository.findOneBy({
        id: userData.avatarId,
      });
      if (media && media.state !== 'ready')
        throw new ForbiddenException('Avatar media is not ready');
      if (media) {
        newUser.avatar = media;
      }
    }

    try {
      const saved = await this.usersRepository.save(newUser);
      this.eventEmitter.emit('user.created', {
        userId: saved.id,
        fullname: saved.fullname || saved.email,
        email: saved.email,
        emailVerified: !!options?.autoVerify,
      });
      return saved;
    } catch (error) {
      this.handleDbError(error);
    }
  }

  /**
   * Resolve a verified Google identity to a local account. Unknown Google
   * accounts become active, verified `user` accounts so mobile sign-in does not
   * depend on a separate registration screen. A unique-email conflict means a
   * concurrent sign-in won the race, so re-read and return that account.
   */
  async findOrCreateGoogleUser(input: {
    email: string;
    fullname?: string | null;
  }): Promise<User> {
    const existing = await this.findOneByEmail(input.email);
    if (existing) return existing;

    const userRole = await this.rolesRepository.findOneBy({ name: 'user' });
    if (!userRole) {
      throw new ServiceUnavailableException(
        'The default user role is not configured',
      );
    }

    try {
      const created = await this.create(
        {
          email: input.email,
          password: crypto.randomBytes(32).toString('hex'),
          fullname: input.fullname?.trim() || undefined,
          roleIds: [userRole.id],
        },
        { autoVerify: true, registerMethod: RegisterMethodEnum.GOOGLE },
      );
      return await this.findOne(created.id);
    } catch (error) {
      if (error instanceof ConflictException) {
        const raced = await this.findOneByEmail(input.email);
        if (raced) return raced;
      }
      throw error;
    }
  }

  override async findAllPaginated(
    page: number,
    limit: number,
    search?: string,
    sort: string = 'createdAt',
    direction: string = 'DESC',
    relations: string[] = ['roles', 'permissions', 'avatar'],
    filters: FindOptionsWhere<User> = {},
  ) {
    const result = await super.findAllPaginated(
      page,
      limit,
      search,
      sort,
      direction,
      relations,
      filters,
    );
    result.data = presentUsers(result.data);
    return result;
  }

  async listUsers(params: UsersQueryDto) {
    const now = new Date();
    const range = createdInRange(params.createdIn, now, params.timeZone);
    const filters: FindOptionsWhere<User> = {
      ...this.accountStatusWhere(params.accountStatus, now),
      ...(params.registerMethod
        ? { registerMethod: params.registerMethod }
        : {}),
      ...(range
        ? {
            createdAt: Raw(
              (column) => `${column} >= :rangeFrom AND ${column} < :rangeTo`,
              { rangeFrom: range.from, rangeTo: range.to },
            ),
          }
        : {}),
    };
    if (params.paginated) {
      return this.findAllPaginated(
        params.page ?? 1,
        params.limit ?? 10,
        params.search,
        params.sort,
        params.direction,
        undefined,
        filters,
      );
    }
    const users =
      (await super.findAll(
        ['roles', 'roles.permissions', 'permissions', 'avatar'],
        {
          where: this.listWhere(params.search, filters),
          order: {
            [this.safeSort(params.sort ?? 'createdAt')]:
              params.direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
          },
        },
      )) ?? [];
    return presentUsers(users);
  }

  private accountStatusWhere(
    status: AccountStatus | undefined,
    now: Date,
  ): FindOptionsWhere<User> {
    if (!status) return {};
    const unlocked = Raw(
      (column) => `(${column} IS NULL OR ${column} <= :statusNow)`,
      { statusNow: now },
    );
    switch (status) {
      case 'INACTIVE':
        return { isActive: false };
      case 'LOCKED':
        return {
          isActive: true,
          lockedUntil: Raw((column) => `${column} > :statusNow`, {
            statusNow: now,
          }),
        };
      case 'UNVERIFIED':
        return {
          isActive: true,
          emailVerifiedAt: IsNull(),
          lockedUntil: unlocked,
        };
      case 'ACTIVE':
        return {
          isActive: true,
          emailVerifiedAt: Not(IsNull()),
          lockedUntil: unlocked,
        };
    }
  }

  override async findAll(): Promise<User[]> {
    const users =
      (await super.findAll([
        'roles',
        'roles.permissions',
        'permissions',
        'avatar',
      ])) ?? [];
    return presentUsers(users);
  }

  /**
   * An account edit made through the API (REST or GraphQL), checked against the
   * caller. Owners may change their basic info but never their own access or
   * email: login matches accounts by email, so a self-service change would let
   * someone claim an address they don't own and receive its owner's sign-in.
   * Everyone else needs the dedicated manage_* permission for access fields and
   * may only grant what they hold.
   */
  async updateAs(
    actor: AuthenticatedUser,
    id: number,
    updateUserDto: UpdateUserDto,
  ): Promise<User> {
    const target = await this.findOne(id);
    const isOwner = actor.userId === id;
    const isSuperadmin = this.grantPolicy.isSuperadmin(actor);
    const changes: UpdateUserDto = { ...updateUserDto };

    if (isOwner && !isSuperadmin) {
      delete changes.roleIds;
      delete changes.permissionIds;
    }
    if (!isOwner) this.grantPolicy.assertCanManageAccount(actor, target);

    const emailChanged =
      changes.email !== undefined &&
      changes.email.toLowerCase() !== target.email.toLowerCase();
    if (emailChanged && isOwner && !isSuperadmin) {
      throw new ForbiddenException(
        'Your email address can only be changed by an administrator',
      );
    }

    if (changes.roleIds) {
      this.grantPolicy.requirePermission(actor, 'users.manage_roles');
      await this.grantPolicy.assertCanGrantRoles(
        actor,
        changes.roleIds,
        target.roles?.map((role) => role.id),
      );
    }
    if (changes.permissionIds) {
      this.grantPolicy.requirePermission(actor, 'users.manage_permissions');
      await this.grantPolicy.assertCanGrantPermissions(
        actor,
        changes.permissionIds,
        target.permissions?.map((permission) => permission.id),
      );
    }

    if (changes.avatarId && !isSuperadmin) {
      const media = await this.mediaRepository.findOneBy({
        id: changes.avatarId,
      });
      if (media && media.userId !== id && media.userId !== actor.userId) {
        throw new ForbiddenException(
          "An avatar must be an upload of yours or this user's",
        );
      }
    }

    // A new address hasn't been proven yet.
    return this.update(
      id,
      changes,
      emailChanged ? { emailVerifiedAt: null } : {},
    );
  }

  /** Admin-only activation switch; self-deactivation is never allowed. */
  async setActiveAs(
    actor: AuthenticatedUser,
    id: number,
    isActive: boolean,
    ipAddress: string | null = null,
  ): Promise<User> {
    const target = await this.findOne(id);
    if (actor.userId === id && !isActive)
      throw new ForbiddenException('You cannot deactivate your own account');
    this.grantPolicy.assertCanManageAccount(actor, target);

    const user = await this.usersRepository.preload({ id, isActive });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    await this.usersRepository.save(user);
    if (!isActive) await this.sessionsService.revokeAllForUser(id);
    const updated = await this.findOne(id);
    const event: UserStatusUpdatedEvent = {
      actorId: actor.userId,
      actorEmail: actor.email,
      targetId: id,
      targetEmail: updated.email,
      isActive,
      ipAddress,
    };
    this.eventEmitter.emit('user.status_updated', event);
    return updated;
  }

  /**
   * Checks an admin action on one account: superadmin accounts are off limits
   * to non-superadmins, and roles/permissions being added must be grantable.
   */
  async assertCanManage(
    actor: AuthenticatedUser,
    id: number,
    grants: { roleIds?: number[]; permissionIds?: number[] } = {},
  ): Promise<void> {
    const target = await this.findOne(id);
    this.grantPolicy.assertCanManageAccount(actor, target);
    if (grants.roleIds) {
      await this.grantPolicy.assertCanGrantRoles(
        actor,
        grants.roleIds,
        target.roles?.map((role) => role.id),
      );
    }
    if (grants.permissionIds) {
      await this.grantPolicy.assertCanGrantPermissions(
        actor,
        grants.permissionIds,
        target.permissions?.map((permission) => permission.id),
      );
    }
  }

  async assertCanManageMany(
    actor: AuthenticatedUser,
    ids: number[],
  ): Promise<void> {
    if (this.grantPolicy.isSuperadmin(actor)) return;
    const users = await this.usersRepository.find({
      where: { id: In(ids) },
      relations: { roles: true },
    });
    users.forEach((user) =>
      this.grantPolicy.assertCanManageAccount(actor, user),
    );
  }

  override async update(
    id: number,
    updateUserDto: UpdateUserDto,
    overrides: Partial<Pick<User, 'emailVerifiedAt'>> = {},
  ): Promise<User> {
    const user = await this.usersRepository.preload({
      id,
      ...updateUserDto,
      ...(updateUserDto.email !== undefined && {
        email: normalizeEmail(updateUserDto.email),
      }),
      ...overrides,
    });

    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }

    if (updateUserDto.password) {
      user.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    if (updateUserDto.roleIds) {
      const roles = await this.rolesRepository.findBy({
        id: In(updateUserDto.roleIds),
      });
      user.roles = roles;
    }

    if (updateUserDto.permissionIds) {
      const permissions = await this.permissionsRepository.findBy({
        id: In(updateUserDto.permissionIds),
      });
      user.permissions = permissions;
    }

    if (updateUserDto.avatarId) {
      const media = await this.mediaRepository.findOneBy({
        id: updateUserDto.avatarId,
      });
      if (media && media.state !== 'ready')
        throw new ForbiddenException('Avatar media is not ready');
      if (media) {
        user.avatar = media;
      }
    }

    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      this.handleDbError(error);
    }
  }

  override async findOne(id: number): Promise<User> {
    const user = await super.findOne(id, [
      'roles',
      'roles.permissions',
      'permissions',
      'avatar',
    ]);
    return presentUser(user);
  }

  override async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.usersRepository.softRemove(user);
    this.eventEmitter.emit('user.deleted', {
      userId: user.id,
      fullname: user.fullname || user.email,
    });
  }

  override async removeMany(ids: number[]): Promise<{ deleted: number }> {
    const users = await this.usersRepository.find({ where: { id: In(ids) } });
    if (users.length) {
      await this.usersRepository.softRemove(users);
      for (const user of users) {
        this.eventEmitter.emit('user.deleted', {
          userId: user.id,
          fullname: user.fullname || user.email,
        });
      }
    }
    return { deleted: users.length };
  }

  // Role Management
  async syncRoles(id: number, roleIds: number[]) {
    const user = await this.findOne(id);
    const roles = await this.rolesRepository.findBy({ id: In(roleIds) });
    user.roles = roles;
    const saved = await this.usersRepository.save(user);
    this.eventEmitter.emit('user.roles_updated', {
      userId: user.id,
      fullname: user.fullname || user.email,
    });
    return saved;
  }

  async attachRoles(id: number, roleIds: number[]) {
    const user = await this.findOne(id);
    const roles = await this.rolesRepository.findBy({ id: In(roleIds) });
    const existingIds = user.roles.map((r) => r.id);
    const newRoles = roles.filter((r) => !existingIds.includes(r.id));
    user.roles = [...user.roles, ...newRoles];
    const saved = await this.usersRepository.save(user);
    this.eventEmitter.emit('user.roles_updated', {
      userId: user.id,
      fullname: user.fullname || user.email,
    });
    return saved;
  }

  async detachRoles(id: number, roleIds: number[]) {
    const user = await this.findOne(id);
    user.roles = user.roles.filter((r) => !roleIds.includes(r.id));
    const saved = await this.usersRepository.save(user);
    this.eventEmitter.emit('user.roles_updated', {
      userId: user.id,
      fullname: user.fullname || user.email,
    });
    return saved;
  }

  // Permission Management
  async syncPermissions(id: number, permissionIds: number[]) {
    const user = await this.findOne(id);
    const permissions = await this.permissionsRepository.findBy({
      id: In(permissionIds),
    });
    user.permissions = permissions;
    const saved = await this.usersRepository.save(user);
    this.eventEmitter.emit('user.roles_updated', {
      userId: user.id,
      fullname: user.fullname || user.email,
    });
    return saved;
  }

  async attachPermissions(id: number, permissionIds: number[]) {
    const user = await this.findOne(id);
    const permissions = await this.permissionsRepository.findBy({
      id: In(permissionIds),
    });
    const existingIds = user.permissions.map((p) => p.id);
    const newPermissions = permissions.filter(
      (p) => !existingIds.includes(p.id),
    );
    user.permissions = [...user.permissions, ...newPermissions];
    const saved = await this.usersRepository.save(user);
    this.eventEmitter.emit('user.roles_updated', {
      userId: user.id,
      fullname: user.fullname || user.email,
    });
    return saved;
  }

  async detachPermissions(id: number, permissionIds: number[]) {
    const user = await this.findOne(id);
    user.permissions = user.permissions.filter(
      (p) => !permissionIds.includes(p.id),
    );
    const saved = await this.usersRepository.save(user);
    this.eventEmitter.emit('user.roles_updated', {
      userId: user.id,
      fullname: user.fullname || user.email,
    });
    return saved;
  }

  async markEmailVerified(userId: number): Promise<void> {
    await this.usersRepository.update(userId, {
      emailVerifiedAt: new Date(),
    });
  }

  protected override handleDbError(error: any): never {
    const dbError = error as { code?: string };
    if (dbError.code === '23505') {
      throw new ConflictException('User with this email already exists');
    }
    super.handleDbError(error);
  }
}
