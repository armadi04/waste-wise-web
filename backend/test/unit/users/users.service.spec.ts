import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { RegisterMethodEnum } from '@/users/register-method.enum';
import { UsersService } from '../../../src/users/users.service';
import { User } from '../../../src/users/entities/user.entity';
import { Role } from '../../../src/roles/entities/role.entity';
import { Permission } from '../../../src/permissions/entities/permission.entity';
import { Media } from '../../../src/media/entities/media.entity';
import { GrantPolicyService } from '../../../src/roles/grant-policy.service';
import type { AuthenticatedUser } from '../../../src/auth/interfaces/auth-request.interface';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: Repository<User>;
  let rolesRepository: Repository<Role>;
  let permissionsRepository: Repository<Permission>;
  let mediaRepository: Repository<Media>;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        GrantPolicyService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn().mockResolvedValue([[], 0]),
            create: jest.fn((dto: Partial<User>) => ({ ...dto })),
            save: jest.fn((entity: Partial<User>) =>
              Promise.resolve({ id: 1, ...entity }),
            ),
            preload: jest.fn(),
            softRemove: jest.fn(),
            update: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Role),
          useValue: {
            findBy: jest.fn().mockResolvedValue([]),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(Permission),
          useValue: { findBy: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Media),
          useValue: { findOneBy: jest.fn() },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepository = module.get(getRepositoryToken(User));
    rolesRepository = module.get(getRepositoryToken(Role));
    permissionsRepository = module.get(getRepositoryToken(Permission));
    mediaRepository = module.get(getRepositoryToken(Media));
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOneByEmail', () => {
    it('should query by email with the full relation set', async () => {
      const user = { id: 1, email: 'a@b.com' } as User;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);

      const result = await service.findOneByEmail(' A@B.COM ');

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: expect.anything() },
        relations: {
          roles: { permissions: true },
          permissions: true,
          avatar: true,
        },
      });
      const emailFilter = (usersRepository.findOne as jest.Mock).mock
        .calls[0][0].where.email;
      expect(emailFilter.getSql('users.email')).toBe(
        'LOWER(users.email) = LOWER(:email)',
      );
      expect(emailFilter.objectLiteralParameters).toEqual({ email: 'A@B.COM' });
      expect(result).toBe(user);
    });
  });

  describe('create', () => {
    it('should hash the password and emit user.created (unverified)', async () => {
      const result = await service.create({
        email: 'new@b.com',
        password: 'plain-password',
      });

      const created = (usersRepository.create as jest.Mock).mock
        .calls[0][0] as User;
      expect(created.password).not.toBe('plain-password');
      expect(created.password.startsWith('$2')).toBe(true);
      expect(result.emailVerifiedAt).toBeUndefined();
      expect(created.registerMethod).toBe(RegisterMethodEnum.UNKNOWN);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.created',
        expect.objectContaining({ email: 'new@b.com', emailVerified: false }),
      );
    });

    it('should mark email verified and emit emailVerified:true when autoVerify', async () => {
      await service.create(
        { email: 'inv@b.com', password: 'plain-password' },
        { autoVerify: true },
      );

      const saved = (usersRepository.save as jest.Mock).mock
        .calls[0][0] as User;
      expect(saved.emailVerifiedAt).toBeInstanceOf(Date);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.created',
        expect.objectContaining({ emailVerified: true }),
      );
    });

    it('should resolve roles, permissions and avatar when ids are supplied', async () => {
      (rolesRepository.findBy as jest.Mock).mockResolvedValue([{ id: 1 }]);
      (permissionsRepository.findBy as jest.Mock).mockResolvedValue([
        { id: 2 },
      ]);
      (mediaRepository.findOneBy as jest.Mock).mockResolvedValue({
        id: 3,
        state: 'ready',
      });

      await service.create({
        email: 'x@b.com',
        password: 'plain-password',
        roleIds: [1],
        permissionIds: [2],
        avatarId: 3,
      });

      expect(rolesRepository.findBy).toHaveBeenCalled();
      expect(permissionsRepository.findBy).toHaveBeenCalled();
      expect(mediaRepository.findOneBy).toHaveBeenCalledWith({ id: 3 });
    });

    it('should translate a unique-violation into ConflictException', async () => {
      (usersRepository.save as jest.Mock).mockRejectedValue({ code: '23505' });

      await expect(
        service.create({ email: 'dup@b.com', password: 'plain-password' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  it('records explicit creation provenance', async () => {
    const user = await service.create(
      { email: 'otp@b.com', password: 'random-password' },
      { autoVerify: true, registerMethod: RegisterMethodEnum.EMAIL_OTP },
    );
    expect(user.registerMethod).toBe(RegisterMethodEnum.EMAIL_OTP);
  });

  it('combines date/method filters with each search alternative and counts matching rows', async () => {
    await service.listUsers({
      paginated: true,
      page: 2,
      limit: 10,
      search: 'Alice',
      createdIn: '7d',
      registerMethod: RegisterMethodEnum.EMAIL_OTP,
    });
    const options = (usersRepository.findAndCount as jest.Mock).mock
      .calls[0][0];
    expect(options.skip).toBe(10);
    expect(options.where).toHaveLength(2);
    for (const clause of options.where) {
      expect(clause.registerMethod).toBe(RegisterMethodEnum.EMAIL_OTP);
      expect(clause.createdAt.type).toBe('raw');
      expect(clause.createdAt.getSql('createdAt')).toBe(
        'createdAt >= :rangeFrom AND createdAt < :rangeTo',
      );
    }
    expect(options.where[0].email.type).toBe('ilike');
    expect(options.where[1].fullname.type).toBe('ilike');
  });

  it('applies filters and sorting to the unpaginated export', async () => {
    await service.listUsers({
      paginated: false,
      search: 'Alice',
      sort: 'email',
      direction: 'asc',
      registerMethod: RegisterMethodEnum.INVITATION,
    });
    const options = (usersRepository.find as jest.Mock).mock.calls[0][0];
    expect(options.order).toEqual({ email: 'ASC' });
    expect(
      options.where.every(
        (clause: Partial<User>) =>
          clause.registerMethod === RegisterMethodEnum.INVITATION,
      ),
    ).toBe(true);
  });

  describe('update', () => {
    it('should throw NotFoundException when the user does not exist', async () => {
      (usersRepository.preload as jest.Mock).mockResolvedValue(undefined);

      await expect(service.update(999, { fullname: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should hash a new password before saving', async () => {
      (usersRepository.preload as jest.Mock).mockResolvedValue({
        id: 1,
        email: 'a@b.com',
      });

      await service.update(1, { password: 'brand-new-password' });

      const saved = (usersRepository.save as jest.Mock).mock
        .calls[0][0] as User;
      expect(saved.password).not.toBe('brand-new-password');
      expect(saved.password.startsWith('$2')).toBe(true);
    });
  });

  describe('updateAs', () => {
    const actor = (
      userId: number,
      roles: string[] = ['customer'],
      permissions: string[] = [],
    ) =>
      ({
        userId,
        email: `user${userId}@b.com`,
        roles,
        permissions,
        emailVerified: true,
      }) as AuthenticatedUser;

    const target = (overrides: Partial<User> = {}) =>
      ({
        id: 7,
        email: 'owner@b.com',
        roles: [{ id: 3, name: 'customer' }],
        permissions: [],
        ...overrides,
      }) as User;

    beforeEach(() => {
      (usersRepository.findOne as jest.Mock).mockResolvedValue(target());
      (usersRepository.preload as jest.Mock).mockImplementation(
        (value: Partial<User>) => Promise.resolve(value),
      );
    });

    it('refuses an owner changing their own email, so no one can claim an address they do not own', async () => {
      await expect(
        service.updateAs(actor(7), 7, { email: 'victim@b.com' }),
      ).rejects.toThrow(ForbiddenException);
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('lets an owner resend their unchanged email in any case', async () => {
      await service.updateAs(actor(7), 7, {
        email: 'Owner@B.com',
        fullname: 'Owner',
      });
      const preloaded = (usersRepository.preload as jest.Mock).mock
        .calls[0][0] as Partial<User>;
      expect(preloaded.fullname).toBe('Owner');
      expect(preloaded).not.toHaveProperty('emailVerifiedAt');
    });

    it('drops access fields from an owner editing themselves', async () => {
      await service.updateAs(actor(7, ['admin'], ['users.update']), 7, {
        roleIds: [1],
        permissionIds: [9],
      });
      const preloaded = (usersRepository.preload as jest.Mock).mock
        .calls[0][0] as Partial<User> & { roleIds?: number[] };
      expect(preloaded.roleIds).toBeUndefined();
      expect(rolesRepository.findBy).not.toHaveBeenCalled();
    });

    it('marks an address changed by an administrator as unverified', async () => {
      await service.updateAs(actor(1, ['admin'], ['users.update']), 7, {
        email: 'new@b.com',
      });
      expect(usersRepository.preload).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@b.com', emailVerifiedAt: null }),
      );
    });

    it('keeps superadmin accounts out of reach of other admins', async () => {
      (usersRepository.findOne as jest.Mock).mockResolvedValue(
        target({ roles: [{ id: 1, name: 'superadmin' }] as Role[] }),
      );
      await expect(
        service.updateAs(actor(1, ['admin'], ['users.update']), 7, {
          password: 'taken-over',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('requires users.manage_roles to change roles through an edit', async () => {
      await expect(
        service.updateAs(actor(1, ['admin'], ['users.update']), 7, {
          roleIds: [3],
        }),
      ).rejects.toThrow('users.manage_roles');
    });

    it('refuses granting the superadmin role even with users.manage_roles', async () => {
      (rolesRepository.find as jest.Mock).mockResolvedValue([
        { id: 1, name: 'superadmin', permissions: [] },
      ]);
      await expect(
        service.updateAs(
          actor(1, ['admin'], ['users.update', 'users.manage_roles']),
          7,
          { roleIds: [3, 1] },
        ),
      ).rejects.toThrow('Only a superadmin can grant the superadmin role');
    });

    it("refuses an avatar that belongs to someone else's upload", async () => {
      (mediaRepository.findOneBy as jest.Mock).mockResolvedValue({
        id: 40,
        userId: 99,
      });
      await expect(
        service.updateAs(actor(7), 7, { avatarId: 40 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assertCanManage', () => {
    it('lets a superadmin manage another superadmin', async () => {
      (usersRepository.findOne as jest.Mock).mockResolvedValue({
        id: 2,
        roles: [{ id: 1, name: 'superadmin' }],
        permissions: [],
      });
      await expect(
        service.assertCanManage(
          {
            userId: 1,
            email: 'root@b.com',
            roles: ['superadmin'],
            permissions: [],
            emailVerified: true,
          },
          2,
          { roleIds: [1] },
        ),
      ).resolves.toBeUndefined();
    });

    it('refuses deleting a superadmin in a bulk delete by a non-superadmin', async () => {
      (usersRepository.find as jest.Mock).mockResolvedValue([
        { id: 2, roles: [] },
        { id: 3, roles: [{ id: 1, name: 'superadmin' }] },
      ]);
      await expect(
        service.assertCanManageMany(
          {
            userId: 1,
            email: 'admin@b.com',
            roles: ['admin'],
            permissions: ['users.delete'],
            emailVerified: true,
          },
          [2, 3],
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markEmailVerified', () => {
    it('should set emailVerifiedAt via repository update', async () => {
      await service.markEmailVerified(7);
      expect(usersRepository.update).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ emailVerifiedAt: expect.any(Date) }),
      );
    });
  });

  describe('role management', () => {
    it('attachRoles should append only the roles not already present', async () => {
      (usersRepository.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        roles: [{ id: 1 }],
        email: 'a@b.com',
      });
      (rolesRepository.findBy as jest.Mock).mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);

      await service.attachRoles(1, [1, 2]);

      const saved = (usersRepository.save as jest.Mock).mock
        .calls[0][0] as User;
      expect(saved.roles.map((r) => r.id)).toEqual([1, 2]);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.roles_updated',
        expect.any(Object),
      );
    });

    it('detachRoles should remove the given role ids', async () => {
      (usersRepository.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        roles: [{ id: 1 }, { id: 2 }],
        email: 'a@b.com',
      });

      await service.detachRoles(1, [1]);

      const saved = (usersRepository.save as jest.Mock).mock
        .calls[0][0] as User;
      expect(saved.roles.map((r) => r.id)).toEqual([2]);
    });

    it('syncRoles should replace the role set entirely', async () => {
      (usersRepository.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        roles: [{ id: 9 }],
        email: 'a@b.com',
      });
      (rolesRepository.findBy as jest.Mock).mockResolvedValue([{ id: 1 }]);

      await service.syncRoles(1, [1]);

      const saved = (usersRepository.save as jest.Mock).mock
        .calls[0][0] as User;
      expect(saved.roles.map((r) => r.id)).toEqual([1]);
    });
  });

  describe('permission management', () => {
    it('syncPermissions should replace the permission set', async () => {
      (usersRepository.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        permissions: [{ id: 9 }],
        email: 'a@b.com',
      });
      (permissionsRepository.findBy as jest.Mock).mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);

      await service.syncPermissions(1, [1, 2]);

      const saved = (usersRepository.save as jest.Mock).mock
        .calls[0][0] as User;
      expect(saved.permissions.map((p) => p.id)).toEqual([1, 2]);
    });
  });

  describe('remove', () => {
    it('should soft-remove the user and emit user.deleted', async () => {
      const user = { id: 1, email: 'a@b.com', fullname: 'A' } as User;
      (usersRepository.findOne as jest.Mock).mockResolvedValue(user);

      await service.remove(1);

      expect(usersRepository.softRemove).toHaveBeenCalledWith(user);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'user.deleted',
        expect.objectContaining({ userId: 1 }),
      );
    });
  });
});
