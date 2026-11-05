import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from 'bun:test';
import request from 'supertest';
import type { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { setupTestApp, type TestContext } from './utils/setup-app';
import { adminEmail, adminToken, createUser, tokenFor } from './utils/auth';
import { cleanDatabase } from './utils/db-clean';
import {
  ClassificationStatus,
  Report,
  ReportStatus,
  WasteCategory,
} from '@/reports/entities/report.entity';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0ZkAAAAASUVORK5CYII=',
  'base64',
);

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('Reports (e2e)', () => {
  let ctx: TestContext;
  let server: App;
  let admin: string;

  beforeAll(async () => {
    ctx = await setupTestApp();
    server = ctx.app.getHttpServer();
    admin = await adminToken(ctx);
  });

  beforeEach(async () => {
    await cleanDatabase(ctx.dataSource, adminEmail());
    ctx.classifier.classify.mockClear();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  async function uploadAs(token: string): Promise<number> {
    const res = await request(server)
      .post('/api/v1/media/upload')
      .set(bearer(token))
      .attach('file', PNG, {
        filename: 'waste.png',
        contentType: 'image/png',
      })
      .expect(201);
    return res.body.id as number;
  }

  async function reportUser(email: string, verified = true) {
    return createUser(ctx, { email, roleNames: ['user'], verified });
  }

  async function createReport(
    token: string,
    mediaId: number,
    description = 'plastic bottle pile',
  ) {
    const res = await request(server)
      .post('/api/v1/reports')
      .set(bearer(token))
      .send({ description, mediaId, latitude: -6.2, longitude: 106.8 })
      .expect(201);
    return res.body as Report;
  }

  async function waitForAudit(action: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const res = await request(server)
        .get('/api/v1/audit-logs')
        .query({ action, limit: 10 })
        .set(bearer(admin));
      if (res.status === 200 && res.body.data.length > 0) return res.body.data;
      await Bun.sleep(25);
    }
    throw new Error(`Audit event ${action} was not recorded`);
  }

  describe('authorization', () => {
    it('rejects unauthenticated and permissionless callers', async () => {
      await request(server).get('/api/v1/reports').expect(401);

      const user = await createUser(ctx, { email: 'no-report-perms@test.dev' });
      await request(server)
        .get('/api/v1/reports')
        .set(bearer(tokenFor(ctx, user.id, user.email)))
        .expect(403);
    });
  });

  describe('create and read', () => {
    it('creates a pending report with fake AI output', async () => {
      const owner = await reportUser('owner-create@test.dev');
      const token = tokenFor(ctx, owner.id, owner.email);
      const mediaId = await uploadAs(token);

      const report = await createReport(token, mediaId);

      expect(report).toMatchObject({
        reporterId: owner.id,
        mediaId,
        status: ReportStatus.PENDING,
        predictedCategory: WasteCategory.PLASTIC_WASTE,
        confidence: 0.94,
        modelVersion: '1.0.0',
        classificationStatus: ClassificationStatus.COMPLETED,
      });
      expect(ctx.classifier.classify).toHaveBeenCalledTimes(1);
    });

    it('rejects media owned by another user', async () => {
      const owner = await reportUser('owner-media@test.dev');
      const other = await reportUser('other-media@test.dev');
      const mediaId = await uploadAs(tokenFor(ctx, owner.id, owner.email));

      await request(server)
        .post('/api/v1/reports')
        .set(bearer(tokenFor(ctx, other.id, other.email)))
        .send({ description: 'foreign media', mediaId })
        .expect(403);
    });

    it('scopes user reads and allows admin to read any report', async () => {
      const owner = await reportUser('owner-read@test.dev');
      const other = await reportUser('other-read@test.dev');
      const ownerToken = tokenFor(ctx, owner.id, owner.email);
      const report = await createReport(ownerToken, await uploadAs(ownerToken));

      await request(server)
        .get(`/api/v1/reports/${report.id}`)
        .set(bearer(tokenFor(ctx, other.id, other.email)))
        .expect(403);
      await request(server)
        .get(`/api/v1/reports/${report.id}`)
        .set(bearer(admin))
        .expect(200);

      const own = await request(server)
        .get('/api/v1/reports')
        .set(bearer(ownerToken))
        .expect(200);
      expect(own.body.data.map((item: Report) => item.id)).toEqual([report.id]);
    });
  });

  describe('update and delete', () => {
    it('lets a user update own pending report and reclassifies a new photo', async () => {
      const owner = await reportUser('owner-update@test.dev');
      const token = tokenFor(ctx, owner.id, owner.email);
      const report = await createReport(token, await uploadAs(token));
      const replacement = await uploadAs(token);
      ctx.classifier.classify.mockClear();

      const updated = await request(server)
        .patch(`/api/v1/reports/${report.id}`)
        .set(bearer(token))
        .send({ description: 'updated description', mediaId: replacement })
        .expect(200);

      expect(updated.body.description).toBe('updated description');
      expect(updated.body.mediaId).toBe(replacement);
      expect(ctx.classifier.classify).toHaveBeenCalledTimes(1);
    });

    it('blocks processed-report edits and foreign deletes', async () => {
      const owner = await reportUser('owner-locked@test.dev');
      const other = await reportUser('other-locked@test.dev');
      const token = tokenFor(ctx, owner.id, owner.email);
      const report = await createReport(token, await uploadAs(token));

      await request(server)
        .patch(`/api/v1/reports/${report.id}/status`)
        .set(bearer(admin))
        .send({ status: ReportStatus.IN_PROGRESS })
        .expect(200);

      await request(server)
        .patch(`/api/v1/reports/${report.id}`)
        .set(bearer(token))
        .send({ description: 'too late' })
        .expect(400);
      await request(server)
        .delete(`/api/v1/reports/${report.id}`)
        .set(bearer(token))
        .expect(400);
      await request(server)
        .delete(`/api/v1/reports/${report.id}`)
        .set(bearer(tokenFor(ctx, other.id, other.email)))
        .expect(403);
    });

    it('lets a user delete own pending report and admin delete another report', async () => {
      const user = await reportUser('owner-delete@test.dev');
      const userToken = tokenFor(ctx, user.id, user.email);
      const own = await createReport(userToken, await uploadAs(userToken));

      await request(server)
        .delete(`/api/v1/reports/${own.id}`)
        .set(bearer(userToken))
        .expect(200);
      await request(server)
        .get(`/api/v1/reports/${own.id}`)
        .set(bearer(admin))
        .expect(404);

      const adminReport = await createReport(admin, await uploadAs(admin));
      await request(server)
        .patch(`/api/v1/reports/${adminReport.id}`)
        .set(bearer(admin))
        .send({ description: 'admin edited' })
        .expect(200);
      await request(server)
        .delete(`/api/v1/reports/${adminReport.id}`)
        .set(bearer(admin))
        .expect(200);
    });
  });

  describe('status management', () => {
    it('allows only admins and validates transitions', async () => {
      const user = await reportUser('owner-status@test.dev');
      const userToken = tokenFor(ctx, user.id, user.email);
      const report = await createReport(userToken, await uploadAs(userToken));

      await request(server)
        .patch(`/api/v1/reports/${report.id}/status`)
        .set(bearer(userToken))
        .send({ status: ReportStatus.IN_PROGRESS })
        .expect(403);
      await request(server)
        .patch(`/api/v1/reports/${report.id}/status`)
        .set(bearer(admin))
        .send({ status: 'COMPLETED' })
        .expect(400);
      await request(server)
        .patch(`/api/v1/reports/${report.id}/status`)
        .set(bearer(admin))
        .send({ status: ReportStatus.IN_PROGRESS })
        .expect(200);
      await request(server)
        .patch(`/api/v1/reports/${report.id}/status`)
        .set(bearer(admin))
        .send({ status: ReportStatus.COMPLETED })
        .expect(200);
      await request(server)
        .patch(`/api/v1/reports/${report.id}/status`)
        .set(bearer(admin))
        .send({ status: ReportStatus.PENDING })
        .expect(400);
      await request(server)
        .patch(`/api/v1/reports/${report.id}/status`)
        .set(bearer(admin))
        .send({ status: 'INVALID' })
        .expect(400);
    });
  });

  describe('filters and statistics', () => {
    it('filters, searches, paginates, and scopes stats by role', async () => {
      const first = await reportUser('filter-first@test.dev');
      const second = await reportUser('filter-second@test.dev');
      const firstToken = tokenFor(ctx, first.id, first.email);
      const repo = ctx.app.get<Repository<Report>>(getRepositoryToken(Report));
      const firstMedia = await uploadAs(firstToken);
      const secondMedia = await uploadAs(admin);
      await ctx.dataSource.query(
        'UPDATE users SET fullname = $1 WHERE id = $2',
        ['Filter One', first.id],
      );
      const base = {
        classificationStatus: ClassificationStatus.COMPLETED,
        confidence: 0.9,
        modelVersion: '1.0.0',
        latitude: null,
        longitude: null,
      };
      const rows = await repo.save([
        repo.create({
          ...base,
          reporterId: first.id,
          mediaId: firstMedia,
          description: 'plastic bottle search target',
          status: ReportStatus.PENDING,
          predictedCategory: WasteCategory.PLASTIC_WASTE,
          createdAt: new Date('2026-10-01T01:00:00Z'),
        }),
        repo.create({
          ...base,
          reporterId: first.id,
          mediaId: firstMedia,
          description: 'organic leaf pile',
          status: ReportStatus.COMPLETED,
          predictedCategory: WasteCategory.ORGANIC_WASTE,
          createdAt: new Date('2026-10-02T01:00:00Z'),
        }),
        repo.create({
          ...base,
          reporterId: second.id,
          mediaId: secondMedia,
          description: 'paper box',
          status: ReportStatus.PENDING,
          predictedCategory: WasteCategory.PAPER_WASTE,
          createdAt: new Date('2026-10-03T01:00:00Z'),
        }),
      ]);

      const filtered = await request(server)
        .get('/api/v1/reports')
        .query({
          search: 'Filter One',
          status: ReportStatus.PENDING,
          category: WasteCategory.PLASTIC_WASTE,
          reporterId: first.id,
          from: '2026-09-30',
          to: '2026-10-02',
          sort: 'createdAt',
          direction: 'asc',
          page: 1,
          limit: 1,
        })
        .set(bearer(admin))
        .expect(200);
      expect(filtered.body.data).toHaveLength(1);
      expect(filtered.body.data[0].id).toBe(rows[0].id);
      expect(filtered.body.meta).toMatchObject({
        total: 1,
        page: 1,
        lastPage: 1,
      });

      const userList = await request(server)
        .get('/api/v1/reports')
        .query({ reporterId: second.id })
        .set(bearer(firstToken))
        .expect(200);
      expect(userList.body.data).toHaveLength(2);
      expect(
        userList.body.data.every(
          (item: Report) => item.reporterId === first.id,
        ),
      ).toBe(true);

      const adminStats = await request(server)
        .get('/api/v1/stats/reports')
        .set(bearer(admin))
        .expect(200);
      expect(adminStats.body).toMatchObject({
        total: 3,
        pending: 2,
        completed: 1,
      });
      expect(adminStats.body.byCategory).toMatchObject({
        organic: 1,
        plastic: 1,
        paper: 1,
      });

      const userStats = await request(server)
        .get('/api/v1/stats/reports')
        .set(bearer(firstToken))
        .expect(200);
      expect(userStats.body).toMatchObject({
        total: 2,
        pending: 1,
        completed: 1,
      });
    });
  });

  describe('audit trail', () => {
    it('records create, update, status, and delete actions', async () => {
      const user = await reportUser('owner-audit@test.dev');
      const token = tokenFor(ctx, user.id, user.email);
      const report = await createReport(token, await uploadAs(token));

      await request(server)
        .patch(`/api/v1/reports/${report.id}`)
        .set(bearer(token))
        .send({ description: 'audit update' })
        .expect(200);
      await request(server)
        .patch(`/api/v1/reports/${report.id}/status`)
        .set(bearer(admin))
        .send({ status: ReportStatus.IN_PROGRESS })
        .expect(200);
      await request(server)
        .delete(`/api/v1/reports/${report.id}`)
        .set(bearer(token))
        .expect(400);
      await request(server)
        .delete(`/api/v1/reports/${report.id}`)
        .set(bearer(admin))
        .expect(200);

      const actorByAction: Record<string, string> = {
        'report.created': user.email,
        'report.updated': user.email,
        'report.status_updated': adminEmail(),
        'report.deleted': adminEmail(),
      };
      for (const [action, actorEmail] of Object.entries(actorByAction)) {
        const entries = await waitForAudit(action);
        expect(entries[0]).toMatchObject({
          action,
          subjectType: 'report',
          subjectId: String(report.id),
          actorEmail,
        });
      }
    });
  });
});
