import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from 'bun:test';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import sharp from 'sharp';
import { AppDataSource } from '@/database/data-source';
import { AddPortalAvatarImports1791230000000 } from '@/database/migrations/1791230000000-AddPortalAvatarImports';
import { PortalAvatarImport } from '@/portal/customer/entities/portal-avatar-import.entity';
import { PortalAvatarImportService } from '@/portal/customer/portal-avatar-import.service';
import { PortalAvatarService } from '@/portal/customer/portal-avatar.service';
import { PortalCustomerService } from '@/portal/customer/portal-customer.service';
import { AvatarCleanupService } from '@/media/avatar-cleanup.service';
import { MediaService } from '@/media/media.service';
import { Media } from '@/media/entities/media.entity';
import { User } from '@/users/entities/user.entity';
import { CacheService } from '@/common/cache/cache.service';
import { Logger } from '@nestjs/common';

if (process.env.DB_NAME !== 'kuponmalam_test')
  throw new Error('Dedicated test database required');
const schema = `avatar_test_${randomUUID().replaceAll('-', '')}`;
const picture = 'https://lh3.googleusercontent.com/test-photo';
let db: DataSource;
let avatars: PortalAvatarService;
let queue: PortalAvatarImportService;
let user: User;
let png: Buffer;
let media: {
  uploadAvatar: ReturnType<typeof jest.fn>;
  scheduleAvatarCleanup: ReturnType<typeof jest.fn>;
  deleteAvatarRemote: ReturnType<typeof jest.fn>;
};
let cache: { clearKeys: ReturnType<typeof jest.fn> };
let download: ReturnType<typeof jest.spyOn<typeof globalThis, 'fetch'>>;
let warning: ReturnType<typeof jest.spyOn<typeof Logger.prototype, 'warn'>>;

const userAvatar = async () =>
  (
    await db.query<Array<{ avatarId: number | null }>>(
      'SELECT "avatarId" FROM users WHERE id = $1',
      [user.id],
    )
  )[0].avatarId;
const job = () =>
  db.getRepository(PortalAvatarImport).findOneByOrFail({ userId: user.id });
const profileService = () =>
  Object.assign(Object.create(PortalCustomerService.prototype), {
    dataSource: db,
    usersService: {
      findOne: (id: number) =>
        db
          .getRepository(User)
          .findOneOrFail({ where: { id }, relations: { avatar: true } }),
    },
  }) as PortalCustomerService;

beforeAll(async () => {
  db = new DataSource({
    ...AppDataSource.options,
    database: 'kuponmalam_test',
    schema,
    extra: {
      options: `-c timezone=UTC -c search_path=${schema},public`,
      max: 10,
    },
    migrations: [],
    synchronize: false,
    logging: false,
  });
  await db.initialize();
  await db.query(`CREATE SCHEMA "${schema}"`);
  await db.synchronize();
  png = await sharp({
    create: { width: 64, height: 32, channels: 3, background: 'red' },
  })
    .png()
    .toBuffer();
}, 30000);

afterAll(async () => {
  if (db?.isInitialized) {
    await db.query(`DROP SCHEMA "${schema}" CASCADE`);
    await db.destroy();
  }
});

beforeEach(async () => {
  await db
    .getRepository(PortalAvatarImport)
    .createQueryBuilder()
    .delete()
    .execute();
  user = await db.getRepository(User).save({
    email: `${randomUUID()}@example.test`,
    password: 'test-only',
    fullname: 'Avatar test',
  });
  media = {
    uploadAvatar: jest
      .fn()
      .mockImplementation(
        async (file: { buffer: Buffer; size: number }, owner: number) =>
          db.getRepository(Media).save({
            filename: `test-${randomUUID()}.jpg`,
            mimetype: 'image/jpeg',
            size: file.size,
            userId: owner,
            managedAvatar: true,
            cleanupAt: new Date(Date.now() + 60 * 60_000),
            url: 'https://storage.example.test/avatar.jpg',
          }),
      ),
    scheduleAvatarCleanup: jest.fn().mockImplementation(async (id: number) => {
      await db.getRepository(Media).update(id, { cleanupAt: new Date() });
    }),
    deleteAvatarRemote: jest.fn().mockResolvedValue(undefined),
  };
  cache = { clearKeys: jest.fn().mockResolvedValue(undefined) };
  avatars = new PortalAvatarService(
    db,
    media as unknown as MediaService,
    cache as unknown as CacheService,
  );
  queue = new PortalAvatarImportService(db, avatars);
  download = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => new Response(new Uint8Array(png)));
  warning = jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation(() => undefined);
});

afterEach(() => {
  download.mockRestore();
  warning.mockRestore();
});

describe('Google avatar PostgreSQL lifecycle', () => {
  it('deduplicates concurrent enqueue, exposes pending status, imports and redacts the URL', async () => {
    await Promise.all([
      queue.enqueue(user.id, picture),
      queue.enqueue(user.id, picture),
    ]);
    expect(await db.getRepository(PortalAvatarImport).count()).toBe(1);
    expect(await profileService().getProfile(user.id)).toMatchObject({
      avatarUrl: null,
      avatarImportPending: true,
    });
    expect(download).not.toHaveBeenCalled();
    await queue.dispatchPending();
    expect(await userAvatar()).not.toBeNull();
    expect(await job()).toMatchObject({
      attempts: 1,
      pictureUrl: null,
      leaseUntil: null,
      failedAt: null,
    });
    expect((await job()).completedAt).toBeInstanceOf(Date);
    expect(await profileService().getProfile(user.id)).toMatchObject({
      avatarImportPending: false,
    });
    expect(cache.clearKeys).toHaveBeenCalledWith('*/users*');
    expect(cache.clearKeys).toHaveBeenCalledWith('*/portal/admin*');
  });

  it('bounds the login enqueue lock wait without touching external storage', async () => {
    await queue.enqueue(user.id, picture);
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(
        'SELECT * FROM portal_avatar_imports WHERE "userId" = $1 FOR UPDATE',
        [user.id],
      );
      const start = Date.now();
      await expect(queue.enqueue(user.id, picture)).rejects.toThrow();
      expect(Date.now() - start).toBeLessThan(2_000);
      expect(download).not.toHaveBeenCalled();
      expect(media.uploadAvatar).not.toHaveBeenCalled();
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('uses PostgreSQL locks to preserve a manual upload while two imports race', async () => {
    const reachedStorage = Promise.withResolvers<void>();
    const resumeStorage = Promise.withResolvers<void>();
    const save = media.uploadAvatar.getMockImplementation()!;
    media.uploadAvatar.mockImplementation(async (file, owner) => {
      const row = await save(file, owner);
      reachedStorage.resolve();
      await resumeStorage.promise;
      return row;
    });
    const imports = Promise.all([
      avatars.importGooglePhoto(user.id, picture),
      avatars.importGooglePhoto(user.id, picture),
    ]);
    await reachedStorage.promise;
    media.uploadAvatar.mockImplementation(save);
    const jpeg = await sharp(png).jpeg().toBuffer();
    await avatars.upload(user.id, { buffer: jpeg } as Express.Multer.File);
    const manual = await userAvatar();
    resumeStorage.resolve();
    await imports;
    expect(await userAvatar()).toBe(manual);
    expect(media.scheduleAvatarCleanup).toHaveBeenCalledTimes(2);
    const active = await db
      .getRepository(Media)
      .findOneByOrFail({ id: manual! });
    expect(active.cleanupAt).toBeNull();
  });

  it('links only one of two concurrent Google imports on the same empty account', async () => {
    const staged = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    let count = 0;
    const save = media.uploadAvatar.getMockImplementation()!;
    media.uploadAvatar.mockImplementation(async (file, owner) => {
      const row = await save(file, owner);
      if (++count === 2) staged.resolve();
      await resume.promise;
      return row;
    });
    const pending = Promise.all([
      avatars.importGooglePhoto(user.id, picture),
      avatars.importGooglePhoto(user.id, picture),
    ]);
    await staged.promise;
    resume.resolve();
    await pending;
    expect(await userAvatar()).not.toBeNull();
    expect(media.scheduleAvatarCleanup).toHaveBeenCalledTimes(1);
    const all = await db.getRepository(Media).findBy({ userId: user.id });
    expect(all.filter((row) => row.cleanupAt === null)).toHaveLength(1);
  });

  it('rolls back a failed link transaction and a new cleanup worker retires the staging row', async () => {
    await db.query(
      `CREATE FUNCTION "${schema}".reject_avatar_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."cleanupAt" IS NULL THEN RAISE EXCEPTION 'test link failure'; END IF; RETURN NEW; END $$`,
    );
    await db.query(
      `CREATE TRIGGER test_avatar_link BEFORE UPDATE ON "${schema}".media FOR EACH ROW EXECUTE FUNCTION "${schema}".reject_avatar_link()`,
    );
    try {
      await expect(avatars.importGooglePhoto(user.id, picture)).rejects.toThrow(
        'test link failure',
      );
      expect(await userAvatar()).toBeNull();
      expect(cache.clearKeys).not.toHaveBeenCalled();
    } finally {
      await db.query(`DROP TRIGGER test_avatar_link ON "${schema}".media`);
      await db.query(`DROP FUNCTION "${schema}".reject_avatar_link()`);
    }
    const rows = await db.getRepository(Media).findBy({ userId: user.id });
    expect(rows).toHaveLength(1);
    expect(rows[0].cleanupAt).not.toBeNull();
    const cleanup = new AvatarCleanupService(
      db,
      media as unknown as MediaService,
      cache as unknown as CacheService,
    );
    await cleanup.dispatchPending();
    expect(media.deleteAvatarRemote).toHaveBeenCalledWith(
      expect.objectContaining({ id: rows[0].id }),
    );
    expect(
      await db.getRepository(Media).findOneBy({ id: rows[0].id }),
    ).toBeNull();
  });

  it('recovers a committed photo after cache failure without storing another copy', async () => {
    await queue.enqueue(user.id, picture);
    cache.clearKeys.mockRejectedValueOnce(new Error('Cache unavailable'));
    await queue.dispatchPending();
    expect(await userAvatar()).not.toBeNull();
    expect((await job()).pictureUrl).toBe(picture);
    expect(media.scheduleAvatarCleanup).not.toHaveBeenCalled();
    await db
      .getRepository(PortalAvatarImport)
      .update(user.id, { availableAt: new Date(0) });
    await new PortalAvatarImportService(db, avatars).dispatchPending();
    expect(media.uploadAvatar).toHaveBeenCalledTimes(1);
    expect((await job()).pictureUrl).toBeNull();
    expect(cache.clearKeys).toHaveBeenCalledWith('*/portal/admin*');
  });

  it('recovers an expired lease after a simulated worker restart', async () => {
    await queue.enqueue(user.id, picture);
    const internals = queue as unknown as {
      claimDue(manager: EntityManager): Promise<PortalAvatarImport | null>;
    };
    const claimed = await internals.claimDue(db.manager);
    expect(claimed?.attempts).toBe(1);
    await new PortalAvatarImportService(db, avatars).dispatchPending();
    expect(media.uploadAvatar).not.toHaveBeenCalled();
    await db
      .getRepository(PortalAvatarImport)
      .update(user.id, { leaseUntil: new Date(0) });
    await new PortalAvatarImportService(db, avatars).dispatchPending();
    expect((await job()).attempts).toBe(2);
    expect((await job()).completedAt).not.toBeNull();
  });

  it('retries storage failures without login and redacts after five claimed attempts', async () => {
    await queue.enqueue(user.id, picture);
    media.uploadAvatar.mockRejectedValue(new Error('Storage unavailable'));
    for (let attempt = 1; attempt <= 5; attempt++) {
      await db
        .getRepository(PortalAvatarImport)
        .update(user.id, { availableAt: new Date(0) });
      await new PortalAvatarImportService(db, avatars).dispatchPending();
      expect((await job()).attempts).toBe(attempt);
      if (attempt === 5) {
        expect((await job()).pictureUrl).toBeNull();
        expect((await job()).failedAt).not.toBeNull();
        expect(await profileService().getProfile(user.id)).toMatchObject({
          avatarImportPending: false,
        });
      }
      await queue.enqueue(user.id, picture);
      if (attempt < 5) expect((await job()).attempts).toBe(attempt);
    }
    // Last enqueue explicitly starts a new attempt budget only after the old job failed.
    expect((await job()).attempts).toBe(0);
    expect((await job()).failedAt).toBeNull();
    expect(await userAvatar()).toBeNull();
  });

  it('redacts exhausted leases after repeated crashes and stops pending status', async () => {
    await queue.enqueue(user.id, picture);
    await db
      .getRepository(PortalAvatarImport)
      .update(user.id, { attempts: 5, leaseUntil: new Date(0) });
    await new PortalAvatarImportService(db, avatars).dispatchPending();
    expect(await job()).toMatchObject({ pictureUrl: null, leaseUntil: null });
    expect((await job()).failedAt).not.toBeNull();
    expect(await profileService().getProfile(user.id)).toMatchObject({
      avatarImportPending: false,
    });
    expect(download).not.toHaveBeenCalled();
  });

  it('limits workers across separate instances with an actual advisory lock', async () => {
    const other = await db
      .getRepository(User)
      .save({ email: `${randomUUID()}@example.test`, password: 'test-only' });
    await queue.enqueue(user.id, picture);
    await queue.enqueue(other.id, picture);
    const entered = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    let active = 0;
    let maximum = 0;
    const importer = {
      importGooglePhoto: jest.fn().mockImplementation(async () => {
        maximum = Math.max(maximum, ++active);
        entered.resolve();
        await resume.promise;
        active--;
      }),
    };
    const worker1 = new PortalAvatarImportService(
      db,
      importer as unknown as PortalAvatarService,
    );
    const worker2 = new PortalAvatarImportService(
      db,
      importer as unknown as PortalAvatarService,
    );
    const first = worker1.dispatchPending();
    await entered.promise;
    await worker2.dispatchPending();
    expect(importer.importGooglePhoto).toHaveBeenCalledTimes(1);
    resume.resolve();
    await first;
    expect(importer.importGooglePhoto).toHaveBeenCalledTimes(2);
    expect(maximum).toBe(1);
  });

  it('supports migration down/up and schema parity without synchronize after migration', async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    const migration = new AddPortalAvatarImports1791230000000();
    try {
      await migration.down(runner);
      await migration.up(runner);
      const table = await runner.getTable(`${schema}.portal_avatar_imports`);
      expect(table!.columns.map((c) => c.name).sort()).toEqual(
        db
          .getMetadata(PortalAvatarImport)
          .columns.map((c) => c.databaseName)
          .sort(),
      );
      expect(
        table!.indices.some((i) => i.name === 'IDX_portal_avatar_imports_due'),
      ).toBe(true);
      const drift = await db.driver.createSchemaBuilder().log();
      expect(
        drift.upQueries.filter((query) =>
          query.query.includes('portal_avatar_imports'),
        ),
      ).toEqual([]);
      await queue.enqueue(user.id, picture);
      expect(await job()).toMatchObject({
        attempts: 0,
        leaseUntil: null,
        failedAt: null,
      });
    } finally {
      await runner.release();
    }
  });
});
