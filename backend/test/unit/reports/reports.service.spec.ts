import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, beforeEach, expect, it, jest } from 'bun:test';
import { ReportsService } from '../../../src/reports/reports.service';
import {
  ClassificationStatus,
  Report,
  ReportStatus,
  WasteCategory,
} from '../../../src/reports/entities/report.entity';
import type { AuthenticatedUser } from '../../../src/auth/interfaces/auth-request.interface';
import type { Media } from '../../../src/media/entities/media.entity';

const actor = (userId: number, permissions: string[]) =>
  ({
    userId,
    email: `user${userId}@example.com`,
    roles: ['user'],
    permissions,
    emailVerified: true,
  }) as AuthenticatedUser;

const report = (overrides: Partial<Report> = {}) =>
  ({
    id: 4,
    reporterId: 1,
    mediaId: 9,
    description: 'plastic bottle pile',
    status: ReportStatus.PENDING,
    predictedCategory: null,
    confidence: null,
    classificationStatus: ClassificationStatus.FAILED,
    ...overrides,
  }) as Report;

const media = {
  id: 9,
  userId: 1,
  mimetype: 'image/jpeg',
  size: 1024,
} as Media;

const queryBuilder = (result: unknown[]) => ({
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn(() => Promise.resolve(result)),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(() => Promise.resolve(result)),
});

describe('ReportsService', () => {
  let service: ReportsService;
  let repository: {
    findOne: ReturnType<typeof jest.fn>;
    find: ReturnType<typeof jest.fn>;
    create: ReturnType<typeof jest.fn>;
    save: ReturnType<typeof jest.fn>;
    preload: ReturnType<typeof jest.fn>;
    softRemove: ReturnType<typeof jest.fn>;
    createQueryBuilder: ReturnType<typeof jest.fn>;
    metadata: { columns: Array<{ propertyName: string }> };
  };
  let mediaService: { findOne: ReturnType<typeof jest.fn> };
  let classification: { classify: ReturnType<typeof jest.fn> };

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value: Partial<Report>) => value),
      save: jest.fn((value: Partial<Report>) =>
        Promise.resolve({ id: 4, ...value }),
      ),
      preload: jest.fn(),
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(),
      metadata: { columns: [] },
    };
    mediaService = { findOne: jest.fn(() => Promise.resolve(media)) };
    classification = {
      classify: jest.fn(() =>
        Promise.resolve({
          status: ClassificationStatus.COMPLETED,
          category: WasteCategory.PLASTIC_WASTE,
          confidence: 0.91,
          modelVersion: '1.0.0',
          errorCode: null,
        }),
      ),
    };
    service = new ReportsService(
      repository as never,
      mediaService as never,
      classification as never,
    );
  });

  it('creates a pending report owned by the caller and stores AI output', async () => {
    repository.findOne.mockResolvedValue(
      report({ predictedCategory: WasteCategory.PLASTIC_WASTE }),
    );

    const result = await service.createForActor(actor(1, ['reports.create']), {
      description: 'plastic bottle pile',
      mediaId: 9,
      latitude: -6.2,
      longitude: 106.8,
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reporterId: 1,
        mediaId: 9,
        status: ReportStatus.PENDING,
        predictedCategory: WasteCategory.PLASTIC_WASTE,
        confidence: 0.91,
        classificationStatus: ClassificationStatus.COMPLETED,
      }),
    );
    expect(result.id).toBe(4);
  });

  it('records a report audit event after creation', async () => {
    const emit = jest.fn();
    (service as unknown as { eventEmitter: { emit: jest.Mock } }).eventEmitter =
      {
        emit,
      };
    repository.findOne.mockResolvedValue(report());

    await service.createForActor(actor(1, ['reports.create']), {
      description: 'audited report',
      mediaId: 9,
    });

    expect(emit).toHaveBeenCalledWith(
      'audit.record',
      expect.objectContaining({
        action: 'report.created',
        actorId: 1,
        subjectType: 'report',
        subjectId: 4,
      }),
    );
  });

  it('rejects media owned by another user', async () => {
    mediaService.findOne.mockResolvedValue({ ...media, userId: 2 });

    await expect(
      service.createForActor(actor(1, ['reports.create']), {
        description: 'photo',
        mediaId: 9,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents a user from reading another user report', async () => {
    repository.findOne.mockResolvedValue(report({ reporterId: 2 }));

    await expect(
      service.findOneForActor(actor(1, ['reports.read.own']), 4),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows all-report readers through the ownership check', async () => {
    const value = report({ reporterId: 2 });
    repository.findOne.mockResolvedValue(value);

    await expect(
      service.findOneForActor(actor(9, ['reports.read.all']), 4),
    ).resolves.toBe(value);
  });

  it('prevents a user from updating a processed report', async () => {
    repository.findOne.mockResolvedValue(
      report({ status: ReportStatus.IN_PROGRESS }),
    );

    await expect(
      service.updateForActor(actor(1, ['reports.update.own']), 4, {
        description: 'changed',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents a user from deleting a processed report', async () => {
    repository.findOne.mockResolvedValue(
      report({ status: ReportStatus.COMPLETED }),
    );

    await expect(
      service.removeForActor(actor(1, ['reports.delete.own']), 4),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('scopes list queries to the caller when read.all is absent', async () => {
    const builder = queryBuilder([[report()], 1]);
    repository.createQueryBuilder.mockReturnValue(builder);

    const result = await service.listReports(actor(1, ['reports.read.own']), {
      page: 1,
      limit: 20,
      search: 'plastic',
    });

    expect(builder.andWhere).toHaveBeenCalledWith(
      'report.reporterId = :actorId',
      { actorId: 1 },
    );
    expect(result.meta).toEqual({ total: 1, page: 1, lastPage: 1 });
  });

  it('filters unclassified reports by a missing predicted category', async () => {
    const builder = queryBuilder([[], 0]);
    repository.createQueryBuilder.mockReturnValue(builder);

    await service.listReports(actor(1, ['reports.read.own']), {
      page: 1,
      limit: 20,
      category: 'UNCLASSIFIED',
    });

    expect(builder.andWhere).toHaveBeenCalledWith(
      'report.predictedCategory IS NULL',
    );
    expect(builder.andWhere).not.toHaveBeenCalledWith(
      'report.predictedCategory = :category',
      expect.anything(),
    );
  });

  it('aggregates status and category counts within the caller scope', async () => {
    repository.createQueryBuilder
      .mockReturnValueOnce(
        queryBuilder([
          { status: ReportStatus.PENDING, count: '2' },
          { status: ReportStatus.COMPLETED, count: '1' },
        ]),
      )
      .mockReturnValueOnce(
        queryBuilder([
          { category: WasteCategory.PLASTIC_WASTE, count: '2' },
          { category: null, count: '1' },
        ]),
      );

    const stats = await service.statsForActor(actor(1, ['reports.read.own']));

    expect(stats).toMatchObject({
      total: 3,
      pending: 2,
      completed: 1,
      byCategory: { plastic: 2, unclassified: 1 },
    });
  });

  it('emits a status change event for the reporter after an update', async () => {
    const emit = jest.fn();
    (service as unknown as { eventEmitter: { emit: jest.Mock } }).eventEmitter =
      { emit };
    repository.findOne
      .mockResolvedValueOnce(report({ status: ReportStatus.PENDING }))
      .mockResolvedValueOnce(report({ status: ReportStatus.IN_PROGRESS }));
    repository.preload.mockResolvedValue(
      report({ status: ReportStatus.IN_PROGRESS }),
    );

    await service.updateStatusForActor(
      actor(2, ['reports.status.update', 'reports.read.all']),
      4,
      ReportStatus.IN_PROGRESS,
    );

    expect(emit).toHaveBeenCalledWith('report.status_changed', {
      reportId: 4,
      reporterId: 1,
      actorId: 2,
      from: ReportStatus.PENDING,
      to: ReportStatus.IN_PROGRESS,
    });
  });

  it('does not emit a status change for an invalid transition', async () => {
    const emit = jest.fn();
    (service as unknown as { eventEmitter: { emit: jest.Mock } }).eventEmitter =
      { emit };
    repository.findOne.mockResolvedValue(
      report({ status: ReportStatus.COMPLETED }),
    );

    await expect(
      service.updateStatusForActor(
        actor(2, ['reports.status.update', 'reports.read.all']),
        4,
        ReportStatus.REJECTED,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(emit).not.toHaveBeenCalledWith(
      'report.status_changed',
      expect.anything(),
    );
  });
});
