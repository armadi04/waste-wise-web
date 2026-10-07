import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  setSystemTime,
} from 'bun:test';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AppDataSource } from '@/database/data-source';
import { AddSessionAudienceAndAbsoluteExpiry1791210000000 } from '@/database/migrations/1791210000000-AddSessionAudienceAndAbsoluteExpiry';
import { Role } from '@/roles/entities/role.entity';
import { UserSession } from '@/sessions/entities/user-session.entity';
import { SessionsService } from '@/sessions/sessions.service';
import { User } from '@/users/entities/user.entity';

// Session lifetime rules against PostgreSQL, in a disposable kuponmalam_test schema.
if (process.env.DB_NAME !== 'kuponmalam_test')
  throw new Error('Session policy integration requires kuponmalam_test');

const schema = `session_test_${randomUUID().replaceAll('-', '')}`;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let db: DataSource;
let sessions: SessionsService;
let customerRole: Role;
let staffRole: Role;

const makeUser = (roles: Role[]) =>
  db.getRepository(User).save({
    email: `${randomUUID()}@example.test`,
    password: 'test-only',
    fullname: 'Session test',
    roles,
  });

beforeAll(async () => {
  db = new DataSource({
    ...AppDataSource.options,
    database: 'kuponmalam_test',
    schema,
    migrations: [],
    synchronize: false,
    logging: false,
  });
  await db.initialize();
  await db.query(`CREATE SCHEMA "${schema}"`);
  await db.synchronize();
  sessions = new SessionsService(db.getRepository(UserSession));
  customerRole = await db
    .getRepository(Role)
    .save({ name: 'customer', description: 'Customer' });
  staffRole = await db
    .getRepository(Role)
    .save({ name: 'staff', description: 'Staff' });
}, 30000);

afterAll(async () => {
  setSystemTime();
  if (db?.isInitialized) {
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.destroy();
  }
});

describe('session lifetime policy', () => {
  it('slides a staff session on refresh but ends it at the absolute limit', async () => {
    const user = await makeUser([staffRole]);
    const start = new Date('2030-01-01T00:00:00Z');
    setSystemTime(start);
    const { sessionId, absoluteExpiresAt } = await sessions.start(
      user.id,
      {},
      { audience: 'admin' },
    );
    expect(absoluteExpiresAt.getTime() - start.getTime()).toBe(8 * HOUR);

    setSystemTime(new Date(start.getTime() + 1.5 * HOUR));
    expect(await sessions.isActive(sessionId)).toBe(true);
    const slid = await sessions.touch(sessionId, true);
    expect(slid!.expiresAt.getTime() - start.getTime()).toBe(3.5 * HOUR);

    setSystemTime(new Date(start.getTime() + 7 * HOUR));
    expect(await sessions.isActive(sessionId)).toBe(false); // idle: no refresh for 3.5 h

    const second = await sessions.start(user.id, {}, { audience: 'admin' });
    for (const hours of [1.5, 3, 4.5, 6, 7.5]) {
      setSystemTime(new Date(start.getTime() + 7 * HOUR + hours * HOUR));
      await sessions.touch(second.sessionId, true);
    }
    const row = await db
      .getRepository(UserSession)
      .findOneByOrFail({ sessionId: second.sessionId });
    expect(row.expiresAt).toEqual(row.absoluteExpiresAt);
    setSystemTime(new Date(row.absoluteExpiresAt.getTime() + 1000));
    expect(await sessions.isActive(second.sessionId)).toBe(false);
  });

  it('keeps customer portal sessions for 14 idle days within 30 days', async () => {
    const user = await makeUser([customerRole]);
    const start = new Date('2030-02-01T00:00:00Z');
    setSystemTime(start);
    const { sessionId } = await sessions.start(
      user.id,
      {},
      { audience: 'portal' },
    );
    setSystemTime(new Date(start.getTime() + 13 * DAY));
    expect(await sessions.isActive(sessionId)).toBe(true);
    await sessions.touch(sessionId, true);
    setSystemTime(new Date(start.getTime() + 26 * DAY));
    expect(await sessions.isActive(sessionId)).toBe(true);
    setSystemTime(new Date(start.getTime() + 31 * DAY));
    expect(await sessions.isActive(sessionId)).toBe(false);
  });
});

describe('session audience migration', () => {
  it('backfills audience and deadlines so old staff sessions end', async () => {
    setSystemTime();
    const customer = await makeUser([customerRole]);
    const staff = await makeUser([staffRole, customerRole]);
    const now = Date.now();
    const repo = db.getRepository(UserSession);
    const old = (userId: number, createdAgo: number, lastActiveAgo: number) =>
      repo.save({
        sessionId: randomUUID(),
        userId,
        lastActiveAt: new Date(now - lastActiveAgo),
        expiresAt: new Date(now + 7 * DAY),
        absoluteExpiresAt: new Date(now + 7 * DAY),
      });
    const staffOld = await old(staff.id, 10 * HOUR, 5 * 60 * 1000);
    const staffRecent = await old(staff.id, 1 * HOUR, 10 * 60 * 1000);
    const customerOld = await old(customer.id, 3 * DAY, 2 * DAY);
    // createdAt is managed by TypeORM; set it explicitly for the backfill.
    for (const [row, ago] of [
      [staffOld, 10 * HOUR],
      [staffRecent, HOUR],
      [customerOld, 3 * DAY],
    ] as const)
      await repo.query(
        `UPDATE "${schema}".user_sessions SET "createdAt" = $1 WHERE id = $2`,
        [new Date(now - ago), row.id],
      );

    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(`SET LOCAL search_path TO "${schema}", public`);
      const migration = new AddSessionAudienceAndAbsoluteExpiry1791210000000();
      await migration.down(runner);
      await migration.up(runner);
      const rows = (await runner.query(
        `SELECT id, audience, "expiresAt" > now() AS active FROM user_sessions WHERE id = ANY($1) ORDER BY id`,
        [[staffOld.id, staffRecent.id, customerOld.id]],
      )) as Array<{ id: number; audience: string; active: boolean }>;
      expect(rows.map((row) => [row.audience, row.active])).toEqual([
        ['admin', false], // older than the 8 h absolute limit
        ['admin', true],
        ['portal', true], // 2 days idle is within 14 days
      ]);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });
});
