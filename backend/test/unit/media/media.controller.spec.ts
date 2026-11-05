/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- needed by tsconfig.test.json (bundler resolution) */
import 'reflect-metadata';
import { describe, expect, it, mock } from 'bun:test';
import type { IAuthRequest } from '@/auth/interfaces/auth-request.interface';

// Load Nest-side modules dynamically in dependency order under Bun's test runner.
await import('@nestjs/core');
const { CacheInterceptor } = await import('@nestjs/cache-manager');
const { MediaController } = await import('@/media/media.controller');
const { NotFoundException } = await import('@nestjs/common');
const { instanceToPlain } = await import('class-transformer');
const { Media } = await import('@/media/entities/media.entity');
// INTERCEPTORS_METADATA from @nestjs/common/constants.
const INTERCEPTORS_METADATA = '__interceptors__';

const interceptorsOf = (handler: unknown) =>
  (Reflect.getMetadata(INTERCEPTORS_METADATA, handler as object) ??
    []) as unknown[];

describe('MediaController caching', () => {
  // The response cache is keyed by URL alone; both reads depend on who asks
  // (own files vs media.read_all, and an in-handler ownership check).
  it('never serves media reads from the shared response cache', () => {
    expect(interceptorsOf(MediaController.prototype.findAll)).not.toContain(
      CacheInterceptor,
    );
    expect(interceptorsOf(MediaController.prototype.findOne)).not.toContain(
      CacheInterceptor,
    );
  });
});

describe('media deletion authorization and serialization', () => {
  const actor = {
    user: { userId: 7, roles: [], permissions: ['media.delete'] },
  } as unknown as IAuthRequest;
  it('rejects the entire batch before deleting any foreign-owned record', async () => {
    const deleteMany = mock(async () => ({ results: [] }));
    const service = {
      findForDeletion: mock(async (id: number) => ({
        id,
        userId: id === 1 ? 7 : 8,
      })),
      deleteMany,
    };
    const controller = new MediaController(
      service as never,
      {
        clearKeys: mock(async () => undefined),
      } as never,
    );
    await expect(controller.bulkRemove({ ids: [1, 2] }, actor)).rejects.toThrow(
      'permission',
    );
    expect(deleteMany).not.toHaveBeenCalled();
  });
  it('allows missing IDs to appear as partial outcomes while checking existing ownership', async () => {
    const result = {
      deleted: 1,
      queued: 0,
      failed: 1,
      results: [
        { id: 1, status: 'failed', code: 'NOT_FOUND' },
        { id: 2, status: 'deleted' },
      ],
    };
    const service = {
      findForDeletion: mock()
        .mockRejectedValueOnce(new NotFoundException())
        .mockResolvedValueOnce({ userId: 7 }),
      deleteMany: mock(async () => result),
    };
    const controller = new MediaController(
      service as never,
      {
        clearKeys: mock(async () => undefined),
      } as never,
    );
    expect(await controller.bulkRemove({ ids: [1, 2] }, actor)).toEqual(
      result as never,
    );
  });
  it('does not serialize internal cleanup capabilities or location bindings', () => {
    const media = Object.assign(new Media(), {
      id: 1,
      state: 'pending',
      cleanupLeaseToken: 'test-lease',
      cleanupAt: new Date(),
      storageFingerprint: '0'.repeat(64),
      remoteName: 'internal-key',
      filename: 'public.pdf',
    });
    const serialized = instanceToPlain(media);
    for (const key of [
      'state',
      'cleanupLeaseToken',
      'cleanupAt',
      'storageFingerprint',
      'remoteName',
    ])
      expect(serialized[key]).toBeUndefined();
    expect(serialized.filename).toBe('public.pdf');
  });
});

describe('media view access', () => {
  const makeController = (isPrivate: boolean) =>
    new MediaController(
      {
        findOne: mock(async () => ({ id: 5, userId: 7, isPrivate })),
        getSignedUrl: mock(async () => 'https://signed.example/file'),
      } as never,
      { clearKeys: mock(async () => undefined) } as never,
    );
  const reply = () => {
    const redirect = mock(() => undefined);
    return { redirect, res: { redirect } as never };
  };
  const asUser = (
    userId: number,
    permissions: string[] = [],
    roles: string[] = [],
  ) => ({ user: { userId, permissions, roles } }) as never;

  it('serves public media (avatars) anonymously', async () => {
    const r = reply();
    await makeController(false).viewFile(5, {} as never, r.res);
    expect(r.redirect).toHaveBeenCalled();
  });

  it('refuses anonymous access to private media', async () => {
    const r = reply();
    await expect(
      makeController(true).viewFile(5, {} as never, r.res),
    ).rejects.toThrow('Sign in');
    expect(r.redirect).not.toHaveBeenCalled();
  });

  it('refuses a different signed-in user without staff permission', async () => {
    await expect(
      makeController(true).viewFile(5, asUser(8), reply().res),
    ).rejects.toThrow('do not have access');
  });

  it('allows the owner and report-reading staff', async () => {
    for (const req of [asUser(7), asUser(1, ['reports.read.all'])]) {
      const r = reply();
      await makeController(true).viewFile(5, req, r.res);
      expect(r.redirect).toHaveBeenCalled();
    }
  });
});
