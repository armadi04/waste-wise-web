import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { Repository } from 'typeorm';
import { DataloaderService } from '../../../../src/graphql/dataloaders/dataloader.service';
import { User } from '@/users/entities/user.entity';
import { Role } from '@/roles/entities/role.entity';
import { Permission } from '@/permissions/entities/permission.entity';

describe('DataloaderService', () => {
  let userRepo: { find: jest.Mock };
  let roleRepo: { find: jest.Mock };
  let service: DataloaderService;

  beforeEach(() => {
    userRepo = { find: jest.fn() };
    roleRepo = { find: jest.fn() };
    service = new DataloaderService(
      userRepo as unknown as Repository<User>,
      roleRepo as unknown as Repository<Role>,
    );
  });

  it('returns userRoles aligned to the requested ids, [] for misses', async () => {
    const roleA = { id: 10, name: 'admin' } as Role;
    userRepo.find.mockResolvedValue([{ id: 2, roles: [roleA] }]);

    const result = await service.createLoaders().userRoles.loadMany([1, 2, 3]);

    expect(result).toEqual([[], [roleA], []]);
    // A single batched query, not one per id.
    expect(userRepo.find).toHaveBeenCalledTimes(1);
  });

  it('returns rolePermissions aligned to the requested ids', async () => {
    const perm = { id: 5, name: 'users.read' } as unknown as Permission;
    roleRepo.find.mockResolvedValue([{ id: 7, permissions: [perm] }]);

    const result = await service
      .createLoaders()
      .rolePermissions.loadMany([7, 8]);

    expect(result).toEqual([[perm], []]);
  });

  it('returns userById aligned to the requested ids, null for misses', async () => {
    const user = { id: 4 } as User;
    userRepo.find.mockResolvedValue([user]);

    const result = await service.createLoaders().userById.loadMany([4, 9]);

    expect(result).toEqual([user, null]);
  });

  it('mints independent loader sets per call (no cross-request cache)', () => {
    const first = service.createLoaders();
    const second = service.createLoaders();

    expect(first.userRoles).not.toBe(second.userRoles);
  });
});
