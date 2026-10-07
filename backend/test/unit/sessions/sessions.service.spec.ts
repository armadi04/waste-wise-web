import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { SessionsService } from '../../../src/sessions/sessions.service';
import { UserSession } from '../../../src/sessions/entities/user-session.entity';

describe('SessionsService', () => {
  let service: SessionsService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findAndCount: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((dto) => dto),
      save: jest.fn((e) => Promise.resolve(e)),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getRepositoryToken(UserSession), useValue: repository },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(SessionsService);
  });

  it('mints a session id with an expiry', async () => {
    const sessionId = await service.start(1, {
      ipAddress: '10.0.0.1',
      userAgent: 'jest',
    });

    expect(sessionId).toBeTruthy();
    const saved = repository.save.mock.calls[0][0] as UserSession;
    expect(saved.userId).toBe(1);
    expect(saved.ipAddress).toBe('10.0.0.1');
    expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('treats a revoked or expired session as inactive', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.isActive('gone')).resolves.toBe(false);

    repository.findOne.mockResolvedValue({ id: 1 });
    await expect(service.isActive('live')).resolves.toBe(true);
  });

  it('refuses to revoke a session belonging to somebody else', async () => {
    repository.findOne.mockResolvedValue({
      id: 2,
      userId: 99,
      revokedAt: null,
    });

    await expect(service.revokeById(2, 1)).rejects.toThrow(ForbiddenException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('throws when the session does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.revokeById(7)).rejects.toThrow(NotFoundException);
  });

  it('revokes every session except the current one', async () => {
    repository.find.mockResolvedValue([
      { id: 1, sessionId: 'current', revokedAt: null },
      { id: 2, sessionId: 'other', revokedAt: null },
    ]);

    const result = await service.revokeOthersForUser(1, 'current');

    expect(result.revoked).toBe(1);
    expect(repository.save).not.toHaveBeenCalled();
    const [criteria, changes] = repository.update.mock.calls[0];
    expect(criteria.sessionId.value).toEqual(['other']);
    expect(criteria.revokedAt.type).toBe('isNull');
    expect(Object.keys(changes)).toEqual(['revokedAt']);
    expect(changes.revokedAt).toBeInstanceOf(Date);
  });

  it('does not revive a session revoked between refresh read and update', async () => {
    repository.findOne.mockResolvedValue({
      sessionId: 'live',
      audience: 'admin',
      revokedAt: null,
      absoluteExpiresAt: new Date(Date.now() + 3600000),
    });
    repository.update.mockResolvedValue({ affected: 0 });
    expect(await service.touch('live', true)).toBeNull();
    expect(repository.save).not.toHaveBeenCalled();
    const [criteria, changes] = repository.update.mock.calls[0];
    expect(criteria.revokedAt.type).toBe('isNull');
    expect(Object.keys(changes).sort()).toEqual(['expiresAt', 'lastActiveAt']);
  });

  it('extends a live session without passing its absolute deadline', async () => {
    const absoluteExpiresAt = new Date(Date.now() + 60000);
    repository.findOne.mockResolvedValue({
      sessionId: 'live',
      audience: 'admin',
      absoluteExpiresAt,
    });
    repository.update.mockResolvedValue({ affected: 1 });
    const result = await service.touch('live', true);
    expect(result?.expiresAt).toEqual(absoluteExpiresAt);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("leaves impersonated sessions out of the user's own list", async () => {
    await service.findActiveForUser(1);

    const where = repository.find.mock.calls[0][0].where as Record<
      string,
      unknown
    >;
    expect(where.impersonatedById).toBeDefined();
  });

  it('hides impersonated sessions from a reader who cannot impersonate', async () => {
    await service.findAllForAdmin(
      1,
      10,
      undefined,
      'lastActiveAt',
      'DESC',
      false,
    );

    const where = repository.findAndCount.mock.calls[0][0].where as Record<
      string,
      unknown
    >;
    expect(where.impersonatedById).toBeDefined();
  });

  it('shows them to a reader who can', async () => {
    await service.findAllForAdmin(
      1,
      10,
      undefined,
      'lastActiveAt',
      'DESC',
      true,
    );

    const where = repository.findAndCount.mock.calls[0][0].where as Record<
      string,
      unknown
    >;
    expect(where.impersonatedById).toBeUndefined();
  });
});
