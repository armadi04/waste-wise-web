import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { AuditService } from '../../../src/audit/audit.service';
import { AuditLog } from '../../../src/audit/entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findAndCount: jest.Mock;
    findOneBy: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => dto),
      save: jest.fn((e) => Promise.resolve({ id: 1, ...e })),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: repository },
      ],
    }).compile();

    service = module.get(AuditService);
  });

  it('records an event, stringifying the subject id', async () => {
    await service.record({
      action: 'auth.login',
      actorId: 1,
      actorEmail: 'a@b.com',
      subjectType: 'user',
      subjectId: 7,
      summary: 'Signed in',
      ipAddress: '10.0.0.1',
    });

    const [row] = repository.save.mock.calls[0] as [
      { action: string; subjectId: string | null },
    ];
    expect(row.action).toBe('auth.login');
    expect(row.subjectId).toBe('7');
  });

  it('fills the optional fields with null rather than undefined', async () => {
    await service.record({ action: 'auth.login_failed' });

    const [row] = repository.save.mock.calls[0] as [
      { actorId: number | null; subjectId: string | null; metadata: unknown },
    ];
    expect(row.actorId).toBeNull();
    expect(row.subjectId).toBeNull();
    expect(row.metadata).toBeNull();
  });

  it('never lets a failed write break the action being recorded', async () => {
    repository.save.mockRejectedValue(new Error('database down'));

    await expect(
      service.record({ action: 'auth.login' }),
    ).resolves.toBeUndefined();
  });

  it('propagates durable delivery failures so the outbox can retry', async () => {
    repository.save.mockRejectedValue(new Error('database down'));
    await expect(
      service.record({ action: 'user.created', eventId: 'user:1' }),
    ).rejects.toThrow('database down');
  });

  it('skips an already recorded durable event', async () => {
    repository.findOneBy.mockResolvedValue({ id: 1, eventId: 'payment:1' });
    await service.record({ action: 'user.created', eventId: 'user:1' });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('scopes the listing to one action when asked', async () => {
    await service.findAllPaginated(
      1,
      20,
      undefined,
      'createdAt',
      'DESC',
      'auth.login',
    );

    const [options] = repository.findAndCount.mock.calls[0] as [
      { where: { action?: string } },
    ];
    expect(options.where.action).toBe('auth.login');
  });
});
