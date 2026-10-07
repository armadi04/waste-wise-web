import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { NotificationsService } from '../../../src/notifications/notifications.service';
import { Notification } from '../../../src/notifications/entities/notification.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let queryBuilder: Record<string, jest.Mock>;
  let createQueryBuilder: jest.Mock;

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getCount: jest.fn().mockResolvedValue(0),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    createQueryBuilder = jest.fn(() => queryBuilder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: { createQueryBuilder },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllForUser', () => {
    it('should scope the query to the user and roles and paginate', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[{ id: 1 }], 1]);

      const result = await service.findAllForUser(7, ['admin'], 1, 10);

      expect(queryBuilder.where).toHaveBeenCalledWith('n.userId = :userId', {
        userId: 7,
      });
      expect(queryBuilder.orWhere).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ roles: ['admin'], userId: 7 }),
      );
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.meta).toEqual({ total: 1, page: 1, lastPage: 1 });
    });

    it('should fall back to a sentinel role when the user has no roles', async () => {
      await service.findAllForUser(7, [], 1, 10);

      expect(queryBuilder.orWhere).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ roles: ['__none__'] }),
      );
    });

    it('should normalize a non-positive page to the first page', async () => {
      await service.findAllForUser(7, ['admin'], 0, 10);
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
    });
  });

  describe('markAllAsRead', () => {
    it('should build an update query and execute it', async () => {
      await service.markAllAsRead(7, ['admin']);

      expect(queryBuilder.update).toHaveBeenCalledWith(Notification);
      expect(queryBuilder.set).toHaveBeenCalledWith({ isRead: true });
      expect(queryBuilder.execute).toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('should return the count of unread notifications', async () => {
      queryBuilder.getCount.mockResolvedValue(3);

      await expect(service.getUnreadCount(7, ['admin'])).resolves.toBe(3);
    });
  });
});
