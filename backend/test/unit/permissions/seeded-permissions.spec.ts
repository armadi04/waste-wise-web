import { describe, expect, it } from 'bun:test';
import 'reflect-metadata';
const { PERMISSIONS_KEY } = await import('@/auth/permissions.decorator');
const { SEEDED_PERMISSIONS } = await import('@/database/seeder/seeder.service');
const { UsersController } = await import('@/users/users.controller');
const { RolesController } = await import('@/roles/roles.controller');
const { PermissionsController } =
  await import('@/permissions/permissions.controller');
const { MediaController } = await import('@/media/media.controller');
const names = SEEDED_PERMISSIONS.map((permission) => permission.name);

describe('starter permissions', () => {
  it('are unique and contain no retired business permissions', () => {
    expect(new Set(names).size).toBe(names.length);
    expect(names.some((name) => name.includes('portal'))).toBe(false);
  });
  it('seed every permission used by core resource controllers', () => {
    const required = [
      UsersController,
      RolesController,
      PermissionsController,
      MediaController,
    ].flatMap((controller) =>
      Object.getOwnPropertyNames(controller.prototype).flatMap(
        (method) =>
          (Reflect.getMetadata(
            PERMISSIONS_KEY,
            controller.prototype[method] as object,
          ) ?? []) as string[],
      ),
    );
    expect(required.length).toBeGreaterThan(0);
    for (const permission of required) expect(names).toContain(permission);
  });
});
