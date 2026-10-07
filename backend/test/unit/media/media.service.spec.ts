import { describe, beforeEach, it, expect, mock } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { MediaService } from '@/media/media.service';
import { Media } from '@/media/entities/media.entity';
import { MediaStorageService } from '@/media/storage/media-storage.service';
import { MediaCleanupService } from '@/media/media-cleanup.service';
import { MediaUploadPipe } from '@/media/media-upload.pipe';

describe('MediaService lifecycle', () => {
  let row: Media | undefined;
  let service: MediaService;
  let repository: {
    create: ReturnType<typeof mock>;
    save: ReturnType<typeof mock>;
    update: ReturnType<typeof mock>;
    findOne: ReturnType<typeof mock>;
    find: ReturnType<typeof mock>;
    findAndCount: ReturnType<typeof mock>;
  };
  let adapter: {
    upload: ReturnType<typeof mock>;
    getSignedUrl: ReturnType<typeof mock>;
  };
  let deletion: ReturnType<typeof mock>;
  const file = {
    originalname: 'file.pdf',
    mimetype: 'application/pdf',
    size: 5,
    buffer: Buffer.from('bytes'),
  } as Express.Multer.File;

  beforeEach(() => {
    row = undefined;
    repository = {
      create: mock((data: Partial<Media>) => ({
        id: 1,
        cleanupAttempts: 0,
        ...data,
      })),
      save: mock(async (data: Media) => {
        row = { ...data };
        return { ...row };
      }),
      update: mock(async (where: Partial<Media>, data: Partial<Media>) => {
        if (
          !row ||
          Object.entries(where).some(
            ([key, value]) => Reflect.get(row!, key) !== value,
          )
        )
          return { affected: 0 };
        Object.assign(row, data);
        return { affected: 1 };
      }),
      findOne: mock(async ({ where }: { where: Partial<Media> }) =>
        row &&
        Object.entries(where).every(
          ([key, value]) => Reflect.get(row!, key) === value,
        )
          ? { ...row }
          : null,
      ),
      find: mock(async () => []),
      findAndCount: mock(async () => [[], 0]),
    };
    adapter = {
      upload: mock(async (_file, object, reserved) => {
        expect(row?.state).toBe('pending');
        expect(row?.remoteName).toBe(object.remoteName);
        const stored = { ...object, path: 'remote/key', depotFileId: 42 };
        await reserved(stored);
        return stored;
      }),
      getSignedUrl: mock(async () => 'https://storage.example.test/file'),
    };
    deletion = mock(async (id: number) => ({ id, status: 'deleted' }));
    service = new MediaService(
      repository as unknown as Repository<Media>,
      { get: () => 'http://localhost:3001' } as unknown as ConfigService,
      {
        selected: {
          provider: 'depot',
          profile: 'depot-default',
          fingerprint: '0'.repeat(64),
          adapter,
        },
        forMedia: () => adapter,
      } as unknown as MediaStorageService,
      { requestDeletion: deletion } as unknown as MediaCleanupService,
      {
        transform: async (value: Express.Multer.File) => value,
      } as MediaUploadPipe,
    );
  });

  it('persists staging identity before external I/O and publishes only after reservation is stored', async () => {
    const result = await service.uploadFile(file, 7);
    expect(result.state).toBe('ready');
    expect(result.depotFileId).toBe(42);
    expect(result.url).toBe('http://localhost:3001/api/media/1/view');
    expect(result.cleanupAt).toBeNull();
    expect(result.cleanupLeaseToken).toBeNull();
  });
  it('does not create remote objects when staging persistence fails', async () => {
    repository.save.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.uploadFile(file, 7)).rejects.toThrow(
      'Database unavailable',
    );
    expect(adapter.upload).not.toHaveBeenCalled();
  });
  it('rejects non-image avatars before staging or remote upload', async () => {
    await expect(service.uploadFile(file, 7, true)).rejects.toThrow(
      'image is required',
    );
    expect(repository.save).not.toHaveBeenCalled();
    expect(adapter.upload).not.toHaveBeenCalled();
  });
  it('never treats an OAuth client sentinel as unrestricted ownership', async () => {
    await service.findAllMedia(0);
    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { state: 'ready', userId: 0 } }),
    );
    await service.findAllMediaPaginated(
      1,
      10,
      undefined,
      'createdAt',
      'DESC',
      0,
    );
    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 0 }),
      }),
    );
    await expect(service.uploadFile(file, 0)).rejects.toThrow('user account');
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('retains recovery identity when remote reservation succeeded but its ID was not persisted', async () => {
    adapter.upload.mockRejectedValue(
      new Error('Process interrupted after reservation'),
    );
    await expect(service.uploadFile(file, 7)).rejects.toThrow(
      'scheduled for cleanup',
    );
    expect(row?.state).toBe('pending');
    expect(row?.remoteName).toMatch(/^media\/7\/[a-f0-9-]+$/);
    expect(row?.cleanupAt!.getTime()).toBeGreaterThan(Date.now());
    expect(row?.storageFingerprint).toHaveLength(64);
  });
  it('does not publish after another worker took the lease', async () => {
    adapter.upload.mockImplementation(async (_file, object) => {
      row!.cleanupLeaseToken = 'new-worker-token';
      return object;
    });
    await expect(service.uploadFile(file, 7)).rejects.toThrow(
      'scheduled for cleanup',
    );
    expect(row?.state).toBe('pending');
    expect(row?.cleanupLeaseToken).toBe('new-worker-token');
  });
  it('returns per-item outcomes and continues after failures; duplicate IDs execute once', async () => {
    deletion.mockImplementation(async (id: number) => {
      if (id === 2) throw new Error('Database unavailable');
      if (id === 4) throw new NotFoundException();
      return { id, status: id === 3 ? 'queued' : 'deleted' };
    });
    const result = await service.deleteMany([1, 2, 3, 4, 1]);
    expect(result).toMatchObject({ deleted: 1, queued: 1, failed: 2 });
    expect(result.results.map((item) => item.status)).toEqual([
      'deleted',
      'failed',
      'queued',
      'failed',
    ]);
    expect(result.results[3].code).toBe('NOT_FOUND');
    expect(deletion).toHaveBeenCalledTimes(4);
  });
  it('hides staged/deleting rows from public reads', async () => {
    await service.uploadFile(file, 7);
    row!.state = 'pending';
    await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    await service.findAllMediaPaginated(1, 10, 'file', 'createdAt', 'DESC', 7);
    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.arrayContaining([
          expect.objectContaining({ state: 'ready', userId: 7 }),
        ]),
      }),
    );
  });
  it('maps provider read failures to a safe operational response', async () => {
    await service.uploadFile(file, 7);
    adapter.getSignedUrl.mockRejectedValue(
      new Error('Provider failure containing a signed credential'),
    );
    await expect(service.getSignedUrl(1)).rejects.toThrow(
      'Media storage is unavailable',
    );
  });
});
