import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from '@/roles/entities/role.entity';
import { Permission } from '@/permissions/entities/permission.entity';
import { User } from '@/users/entities/user.entity';
import type { IDataLoaders } from './dataloader.types';

/**
 * Builds a fresh set of DataLoaders per request. Loaders must not be shared
 * across requests (their cache would leak data between users), so
 * {@link createLoaders} is called once per GraphQL operation from the Apollo
 * context factory.
 */
@Injectable()
export class DataloaderService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  createLoaders(): IDataLoaders {
    return {
      userRoles: new DataLoader<number, Role[]>((ids) =>
        this.loadUserRelation(ids, 'roles'),
      ),
      userPermissions: new DataLoader<number, Permission[]>((ids) =>
        this.loadUserRelation(ids, 'permissions'),
      ),
      rolePermissions: new DataLoader<number, Permission[]>((ids) =>
        this.loadRolePermissions(ids),
      ),
      userById: new DataLoader<number, User | null>((ids) =>
        this.loadUsersById(ids),
      ),
    };
  }

  /**
   * Batches a User relation (roles or direct permissions) for the given user
   * ids and returns the results in the same order as the requested ids.
   */
  private async loadUserRelation<K extends 'roles' | 'permissions'>(
    ids: ReadonlyArray<number>,
    relation: K,
  ): Promise<Array<User[K]>> {
    const users = await this.userRepository.find({
      where: { id: In([...ids]) },
      relations: { [relation]: true },
    });
    const byId = new Map(users.map((user) => [user.id, user[relation]]));
    return ids.map((id) => byId.get(id) ?? []);
  }

  private async loadRolePermissions(
    ids: ReadonlyArray<number>,
  ): Promise<Permission[][]> {
    const roles = await this.roleRepository.find({
      where: { id: In([...ids]) },
      relations: { permissions: true },
    });
    const byId = new Map(roles.map((role) => [role.id, role.permissions]));
    return ids.map((id) => byId.get(id) ?? []);
  }

  private async loadUsersById(
    ids: ReadonlyArray<number>,
  ): Promise<Array<User | null>> {
    const users = await this.userRepository.find({
      where: { id: In([...ids]) },
    });
    const byId = new Map(users.map((user) => [user.id, user]));
    return ids.map((id) => byId.get(id) ?? null);
  }
}
