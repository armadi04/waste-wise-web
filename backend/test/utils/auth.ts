import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { UsersService } from '@/users/users.service';
import { User } from '@/users/entities/user.entity';
import { Permission } from '@/permissions/entities/permission.entity';
import { Role } from '@/roles/entities/role.entity';
import type { TestContext } from './setup-app';

export function adminEmail(): string {
  return process.env.ADMIN_EMAIL as string;
}

export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD as string;
}

/**
 * Mints a valid JWT for a user id. `JwtStrategy` re-loads the user from the DB
 * and derives roles/permissions there, so the token only needs a valid `sub`
 * and signature — making this the fast path for authenticated requests.
 */
export function tokenFor(
  ctx: TestContext,
  userId: number,
  email = 'user@example.com',
): string {
  const jwt = ctx.app.get(JwtService);
  return jwt.sign({
    sub: userId,
    email,
    roles: [],
    permissions: [],
    emailVerified: true,
  });
}

/** Resolves the seeded superadmin and returns a bearer token for it. */
export async function adminToken(ctx: TestContext): Promise<string> {
  const repo = ctx.app.get<Repository<User>>(getRepositoryToken(User));
  const admin = await repo.findOneByOrFail({ email: adminEmail() });
  return tokenFor(ctx, admin.id, admin.email);
}

export interface CreateUserOptions {
  email: string;
  password?: string;
  permissionNames?: string[];
  roleNames?: string[];
  verified?: boolean;
}

/** Creates a user (optionally with direct permissions / roles) for fixtures. */
export async function createUser(
  ctx: TestContext,
  options: CreateUserOptions,
): Promise<User> {
  const usersService = ctx.app.get(UsersService);
  const permissionRepo = ctx.app.get<Repository<Permission>>(
    getRepositoryToken(Permission),
  );
  const roleRepo = ctx.app.get<Repository<Role>>(getRepositoryToken(Role));

  let permissionIds: number[] | undefined;
  if (options.permissionNames?.length) {
    const perms = await permissionRepo.findBy({
      name: In(options.permissionNames),
    });
    permissionIds = perms.map((p) => p.id);
  }

  let roleIds: number[] | undefined;
  if (options.roleNames?.length) {
    const roles = await roleRepo.findBy({ name: In(options.roleNames) });
    roleIds = roles.map((r) => r.id);
  }

  return usersService.create(
    {
      email: options.email,
      password: options.password ?? 'password123',
      permissionIds,
      roleIds,
    },
    { autoVerify: options.verified ?? true },
  );
}

export interface LoginResult {
  accessToken: string;
  cookies: string[];
  csrfToken: string;
}

/** Performs a real HTTP login and captures the auth cookies + CSRF token. */
export async function loginViaHttp(
  ctx: TestContext,
  email: string,
  password: string,
): Promise<LoginResult> {
  const res = await request(ctx.app.getHttpServer() as App)
    .post('/api/v1/auth/login')
    .send({ email, password });

  const rawCookies = res.headers['set-cookie'];
  const cookies = Array.isArray(rawCookies)
    ? rawCookies
    : rawCookies
      ? [rawCookies]
      : [];
  const csrfCookie = cookies.find((c) => c.startsWith('csrfToken='));
  const csrfToken = csrfCookie
    ? decodeURIComponent(csrfCookie.split('=')[1].split(';')[0])
    : '';

  return {
    accessToken: (res.body as { accessToken: string }).accessToken,
    cookies,
    csrfToken,
  };
}
