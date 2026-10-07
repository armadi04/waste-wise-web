import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test';
import { ConflictException, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import { Media } from '@/media/entities/media.entity';
import { MediaService } from '@/media/media.service';
import { PortalAvatarService } from '@/portal/customer/portal-avatar.service';
import { User } from '@/users/entities/user.entity';
import { CacheService } from '@/common/cache/cache.service';

const picture = 'https://lh3.googleusercontent.com/photo';

describe('PortalAvatarService Google photo import', () => {
  let service: PortalAvatarService;
  let cache: { clearKeys: ReturnType<typeof jest.fn> };
  let owners: ReturnType<typeof jest.fn>;
  let media: {
    uploadAvatar: ReturnType<typeof jest.fn>;
    scheduleAvatarCleanup: ReturnType<typeof jest.fn>;
  };
  let manager: {
    query: ReturnType<typeof jest.fn>;
    findOne: ReturnType<typeof jest.fn>;
    update: ReturnType<typeof jest.fn>;
  };
  let download: ReturnType<typeof jest.spyOn<typeof globalThis, 'fetch'>>;
  let currentAvatar: number | null;
  let nextId: number;
  let png: Buffer;

  beforeEach(async () => {
    currentAvatar = null;
    nextId = 100;
    png = await sharp({
      create: { width: 64, height: 32, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    download = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(new Uint8Array(png)));
    media = {
      uploadAvatar: jest.fn().mockImplementation(async () => ({
        id: nextId++,
        userId: 42,
        managedAvatar: true,
      })),
      scheduleAvatarCleanup: jest.fn().mockResolvedValue(undefined),
    };
    manager = {
      query: jest
        .fn()
        .mockImplementation(async () => [{ avatarId: currentAvatar }]),
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 100, cleanupLeaseUntil: null }),
      update: jest.fn().mockImplementation(async (entity, _id, changes) => {
        if (entity === User) currentAvatar = changes.avatar.id;
      }),
    };
    // Serialize mocked transactions to model the user row lock for concurrent imports.
    let queue = Promise.resolve();
    owners = jest.fn().mockResolvedValue([{ avatarId: null }]);
    cache = { clearKeys: jest.fn().mockResolvedValue(undefined) };
    const dataSource = {
      query: owners,
      transaction: jest
        .fn()
        .mockImplementation(
          (callback: (value: typeof manager) => Promise<boolean>) => {
            const transaction = queue.then(() => callback(manager));
            queue = transaction.then(
              () => undefined,
              () => undefined,
            );
            return transaction;
          },
        ),
    };
    service = new PortalAvatarService(
      dataSource as unknown as DataSource,
      media as unknown as MediaService,
      cache as unknown as CacheService,
    );
  });

  afterEach(() => download.mockRestore());

  it.each(['jpeg', 'png', 'webp'] as const)(
    'copies a %s photo as a managed 512-square JPEG',
    async (format) => {
      const bytes = await sharp(png).toFormat(format).toBuffer();
      download.mockResolvedValueOnce(new Response(new Uint8Array(bytes)));
      await service.importGooglePhoto(42, picture);
      const [file, owner] = media.uploadAvatar.mock.calls[0];
      const metadata = await sharp(file.buffer).metadata();
      expect(owner).toBe(42);
      expect(metadata).toMatchObject({
        format: 'jpeg',
        width: 512,
        height: 512,
      });
      expect(file.size).toBe(file.buffer.length);
      expect(currentAvatar).toBe(100);
      expect(manager.query).toHaveBeenCalledWith(
        expect.stringContaining('FOR UPDATE'),
        [42],
      );
      expect(manager.findOne).toHaveBeenCalledWith(Media, {
        where: { id: 100, userId: 42, managedAvatar: true },
        lock: { mode: 'pessimistic_write' },
      });
      expect(manager.update).toHaveBeenCalledWith(Media, 100, {
        cleanupAt: null,
      });
      expect(media.scheduleAvatarCleanup).not.toHaveBeenCalled();
      expect(cache.clearKeys).toHaveBeenCalledWith('*/users*');
      expect(cache.clearKeys).toHaveBeenCalledWith('*/portal/admin*');
      const [url, options] = download.mock.calls[0];
      expect((url as URL).href).toBe(picture);
      expect(options?.redirect).toBe('error');
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    },
  );

  it.each([
    'http://lh3.googleusercontent.com/photo',
    'https://googleusercontent.com.attacker.test/photo',
    'https://fakegoogleusercontent.com/photo',
    'https://127.0.0.1/photo',
    'https://user:password@lh3.googleusercontent.com/photo',
    'https://lh3.googleusercontent.com:444/photo',
    'not a URL',
  ])('rejects an untrusted URL before any download: %s', async (url) => {
    await expect(service.importGooglePhoto(42, url)).rejects.toThrow();
    expect(download).not.toHaveBeenCalled();
    expect(media.uploadAvatar).not.toHaveBeenCalled();
  });

  it.each([302, 404, 500])(
    'does not store an HTTP %s response',
    async (status) => {
      download.mockResolvedValueOnce(new Response('failed', { status }));
      await expect(service.importGooglePhoto(42, picture)).rejects.toThrow();
      expect(media.uploadAvatar).not.toHaveBeenCalled();
    },
  );

  it('aborts a real response body stalled beyond the download deadline', async () => {
    const realFetch = download.getMockImplementation();
    download.mockRestore();
    const transport = globalThis.fetch;
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array([137, 80, 78, 71]));
            },
          }),
        ),
    });
    download = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_url, options) => transport(server.url, options));
    try {
      const start = Date.now();
      await expect(service.importGooglePhoto(42, picture)).rejects.toThrow();
      expect(Date.now() - start).toBeGreaterThanOrEqual(4_500);
      expect(Date.now() - start).toBeLessThan(8_000);
      expect(media.uploadAvatar).not.toHaveBeenCalled();
    } finally {
      await server.stop(true);
      if (realFetch) download.mockImplementation(realFetch);
    }
  }, 10_000);

  it('rejects a real redirect without following the destination', async () => {
    download.mockRestore();
    const transport = globalThis.fetch;
    let destinationHits = 0;
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: (request) => {
        if (new URL(request.url).pathname === '/target') {
          destinationHits++;
          return new Response('target');
        }
        return Response.redirect(new URL('/target', request.url));
      },
    });
    download = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation((_url, options) => transport(server.url, options));
    try {
      await expect(service.importGooglePhoto(42, picture)).rejects.toThrow();
      expect(destinationHits).toBe(0);
      expect(media.uploadAvatar).not.toHaveBeenCalled();
    } finally {
      await server.stop(true);
    }
  });

  it('propagates a download timeout without staging media', async () => {
    download.mockRejectedValueOnce(new DOMException('Timeout', 'TimeoutError'));
    await expect(service.importGooglePhoto(42, picture)).rejects.toThrow();
    expect(media.uploadAvatar).not.toHaveBeenCalled();
  });

  it('rejects oversized Content-Length before consuming the body', async () => {
    const cancel = jest.fn();
    const stream = new ReadableStream({ cancel });
    download.mockResolvedValueOnce(
      new Response(stream, {
        headers: { 'content-length': String(10 * 1024 * 1024 + 1) },
      }),
    );
    await expect(service.importGooglePhoto(42, picture)).rejects.toThrow();
    expect(cancel).toHaveBeenCalled();
    expect(media.uploadAvatar).not.toHaveBeenCalled();
  });

  it('limits streamed bytes even if Content-Length lies', async () => {
    const cancel = jest.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(10 * 1024 * 1024 + 1));
      },
      cancel,
    });
    download.mockResolvedValueOnce(
      new Response(stream, { headers: { 'content-length': '10' } }),
    );
    await expect(service.importGooglePhoto(42, picture)).rejects.toThrow();
    expect(cancel).toHaveBeenCalled();
    expect(media.uploadAvatar).not.toHaveBeenCalled();
  });

  it.each([
    'invalid bytes',
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>',
  ])('rejects invalid or unsupported image bytes', async (body) => {
    download.mockResolvedValueOnce(new Response(body));
    await expect(service.importGooglePhoto(42, picture)).rejects.toThrow();
    expect(media.uploadAvatar).not.toHaveBeenCalled();
  });

  it('rejects an image over 16 megapixels', async () => {
    const bytes = await sharp({
      create: { width: 4001, height: 4000, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    download.mockResolvedValueOnce(new Response(new Uint8Array(bytes)));
    await expect(service.importGooglePhoto(42, picture)).rejects.toThrow();
    expect(media.uploadAvatar).not.toHaveBeenCalled();
  });

  it('skips external storage for a saved avatar and retries invalidation', async () => {
    owners.mockResolvedValueOnce([{ avatarId: 55 }]);
    await service.importGooglePhoto(42, picture);
    expect(download).not.toHaveBeenCalled();
    expect(media.uploadAvatar).not.toHaveBeenCalled();
    expect(cache.clearKeys).toHaveBeenCalledWith('*/users*');
  });

  it('does not enqueue cleanup for a committed avatar when invalidation fails', async () => {
    cache.clearKeys.mockRejectedValueOnce(new Error('Cache unavailable'));
    await expect(service.importGooglePhoto(42, picture)).rejects.toThrow(
      'Cache unavailable',
    );
    expect(currentAvatar).toBe(100);
    expect(media.scheduleAvatarCleanup).not.toHaveBeenCalled();
  });

  it('preserves a manual avatar linked while the download was in flight', async () => {
    media.uploadAvatar.mockImplementationOnce(async () => {
      currentAvatar = 55;
      return { id: 100 };
    });
    await service.importGooglePhoto(42, picture);
    expect(currentAvatar).toBe(55);
    expect(manager.update).not.toHaveBeenCalled();
    expect(media.scheduleAvatarCleanup).toHaveBeenCalledWith(100);
  });

  it('links only one of two concurrent imports and cleans up the loser', async () => {
    await Promise.all([
      service.importGooglePhoto(42, picture),
      service.importGooglePhoto(42, picture),
    ]);
    expect(currentAvatar).toBe(100);
    expect(
      manager.update.mock.calls.filter(([entity]) => entity === User),
    ).toHaveLength(1);
    expect(media.scheduleAvatarCleanup).toHaveBeenCalledWith(101);
    expect(media.scheduleAvatarCleanup).toHaveBeenCalledTimes(1);
  });

  it('schedules cleanup if the account was deleted', async () => {
    manager.query.mockImplementation(async (sql: string) =>
      sql.includes('SELECT') ? [] : undefined,
    );
    await expect(service.importGooglePhoto(42, picture)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(media.scheduleAvatarCleanup).toHaveBeenCalledWith(100);
  });

  it('does not attach a staging row already claimed by cleanup', async () => {
    manager.findOne.mockResolvedValueOnce({ cleanupLeaseUntil: new Date() });
    await expect(service.importGooglePhoto(42, picture)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.update).not.toHaveBeenCalled();
    expect(media.scheduleAvatarCleanup).toHaveBeenCalledWith(100);
  });

  it('queues cleanup after a link failure and preserves the original error', async () => {
    manager.update.mockRejectedValueOnce(new Error('DB unavailable'));
    media.scheduleAvatarCleanup.mockRejectedValueOnce(
      new Error('Cleanup scheduling unavailable'),
    );
    await expect(service.importGooglePhoto(42, picture)).rejects.toThrow(
      'DB unavailable',
    );
    expect(media.scheduleAvatarCleanup).toHaveBeenCalledWith(100);
  });

  it('propagates storage failure without trying to attach media', async () => {
    media.uploadAvatar.mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(service.importGooglePhoto(42, picture)).rejects.toThrow(
      'Storage unavailable',
    );
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('still lets a manual JPEG upload replace a saved managed avatar', async () => {
    currentAvatar = 55;
    const buffer = await sharp(png).jpeg().toBuffer();
    await service.upload(42, { buffer } as Express.Multer.File);
    expect(currentAvatar).toBe(100);
    expect(manager.update).toHaveBeenCalledWith(
      Media,
      { id: 55, userId: 42, managedAvatar: true },
      { cleanupAt: expect.any(Date) },
    );
    expect(download).not.toHaveBeenCalled();
  });

  it('keeps the manual upload endpoint restricted to JPEG', async () => {
    await expect(
      service.upload(42, { buffer: png } as Express.Multer.File),
    ).rejects.toThrow();
    expect(media.uploadAvatar).not.toHaveBeenCalled();
  });
});
