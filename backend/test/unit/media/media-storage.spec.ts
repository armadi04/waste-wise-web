import type { UploadedMultipartFile } from '@nestjs/platform-fastify/multipart';
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { MediaStorageService } from '@/media/storage/media-storage.service';
import { DepotStorageProvider } from '@/media/storage/depot-storage.provider';
import { S3StorageProvider } from '@/media/storage/s3-storage.provider';
import { storageFingerprint } from '@/config/media-storage.config';
import { envSchema } from '@/config/env';

const baseEnv = {
  DB_HOST: 'localhost',
  DB_USERNAME: 'test',
  DB_PASSWORD: 'test',
  DB_NAME: 'nestplate_test',
  JWT_SECRET: 'test-secret-at-least-16-chars',
  ADMIN_EMAIL: 'admin@example.test',
  ADMIN_PASSWORD: 'test-only-password',
};
const depot = {
  provider: 'depot' as const,
  baseUrl: 'https://depot.example.test',
  apiKey: 'test-only',
};
const s3 = {
  provider: 's3' as const,
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  bucket: 'archive',
  accessKeyId: 'test',
  secretAccessKey: 'test',
  forcePathStyle: true,
};
const registry = (profiles: object, selected = 'current') =>
  new MediaStorageService({
    get: (key: string) =>
      (
        ({
          MEDIA_STORAGE_PROFILES: JSON.stringify(profiles),
          MEDIA_STORAGE_PROFILE: selected,
        }) as Record<string, string>
      )[key],
  } as ConfigService);

describe('storage profiles', () => {
  it('validates selected profiles without requiring inactive legacy credentials', () => {
    expect(envSchema.safeParse(baseEnv).success).toBe(false);
    expect(
      envSchema.safeParse({
        ...baseEnv,
        MEDIA_STORAGE_PROFILES: JSON.stringify({ current: s3 }),
        MEDIA_STORAGE_PROFILE: 'current',
      }).success,
    ).toBe(true);
    expect(
      envSchema.safeParse({
        ...baseEnv,
        MEDIA_STORAGE_PROFILES: '{secret-value',
      }).success,
    ).toBe(false);
  });
  it('keeps archived files on their original profile after switching defaults', async () => {
    const service = registry({ current: depot, archive: s3 });
    const adapter = service.forMedia({
      provider: 's3',
      storageProfile: 'archive',
      storageFingerprint: storageFingerprint(s3),
    });
    const url = new URL(await adapter.getSignedUrl({ path: 'media/1/file' }));
    expect(url.pathname).toBe('/archive/media/1/file');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(service.selected.provider).toBe('depot');
  });
  it('refuses changed physical locations, missing bindings and missing profiles before I/O', () => {
    const service = registry({
      current: { ...s3, bucket: 'different-bucket' },
    });
    expect(() =>
      service.forMedia({
        provider: 's3',
        storageProfile: 'current',
        storageFingerprint: storageFingerprint(s3),
      }),
    ).toThrow('does not match');
    expect(() =>
      service.forMedia({
        provider: 's3',
        storageProfile: 'current',
        storageFingerprint: null,
      }),
    ).toThrow('does not match');
    expect(() =>
      service.forMedia({
        provider: 's3',
        storageProfile: 'missing',
        storageFingerprint: storageFingerprint(s3),
      }),
    ).toThrow('not configured');
  });
  it('allows credential rotation while preserving location identity', () => {
    expect(storageFingerprint({ ...s3, secretAccessKey: 'rotated' })).toBe(
      storageFingerprint(s3),
    );
    expect(storageFingerprint({ ...depot, apiKey: 'rotated' })).toBe(
      storageFingerprint(depot),
    );
  });
});

describe('storage recovery and bounded requests', () => {
  let fetchSpy: { mockRestore: () => void } | undefined;
  afterEach(() => {
    fetchSpy?.mockRestore();
    fetchSpy = undefined;
  });
  it('S3 uses the persisted key, abortable PUT/DELETE, and idempotent missing-object deletion', async () => {
    const adapter = new S3StorageProvider({
      bucket: 'archive',
      accessKeyId: 'test',
      secretAccessKey: 'test',
    });
    const presign = mock(() => 'https://storage.example.test/signed');
    Reflect.set(adapter, 'client', { presign });
    const spy = spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 }),
    );
    fetchSpy = spy;
    const file = {
      mimetype: 'application/pdf',
      buffer: Buffer.from('bytes'),
    } as UploadedMultipartFile;
    const object = { path: 'media/7/stable' };
    const reserved = mock(async () => undefined);
    await adapter.upload(file, object, reserved);
    expect(reserved).toHaveBeenCalledWith(object);
    expect(presign).toHaveBeenCalledWith(
      object.path,
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        method: 'PUT',
      }),
    );
    spy.mockResolvedValue(new Response('', { status: 404 }));
    await adapter.delete(object);
  });
  it('Depot recovers only exact UUID names and owners after a crash before ID persistence', async () => {
    const adapter = new DepotStorageProvider(depot.baseUrl, depot.apiKey);
    const remove = mock(async () => undefined);
    const list = mock(async () => ({
      data: [
        { id: 1, name: 'stable', ownerUserId: 7 },
        { id: 2, name: 'stable-extra', ownerUserId: 7 },
        { id: 3, name: 'stable', ownerUserId: 8 },
      ],
      meta: { totalPages: 1 },
    }));
    Reflect.set(adapter, 'client', { list, delete: remove });
    await adapter.delete({
      path: 'unknown',
      remoteName: 'stable',
      userId: 7,
      depotFileId: null,
    });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(1);
  });
});
