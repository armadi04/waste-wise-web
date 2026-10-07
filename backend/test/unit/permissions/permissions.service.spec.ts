import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { PermissionsService } from '../../../src/permissions/permissions.service';
import { Permission } from '../../../src/permissions/entities/permission.entity';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let repository: Repository<Permission>;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: getRepositoryToken(Permission),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            findAndCount: jest.fn().mockResolvedValue([[], 0]),
            create: jest.fn((dto: Partial<Permission>) => dto),
            save: jest.fn((entity: Partial<Permission>) =>
              Promise.resolve({ id: 1, ...entity }),
            ),
            preload: jest.fn(),
            softRemove: jest.fn(),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
    repository = module.get<Repository<Permission>>(
      getRepositoryToken(Permission),
    );
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return the permission when found', async () => {
      const permission = { id: 1, name: 'users.read' } as Permission;
      (repository.findOne as jest.Mock).mockResolvedValue(permission);

      await expect(service.findOne(1)).resolves.toEqual(permission);
    });

    it('should throw NotFoundException when missing', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create, save and emit a system.create event', async () => {
      const dto = { name: 'reports.read', description: 'Read reports' };

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(dto);
      expect(repository.save).toHaveBeenCalled();
      expect(result).toMatchObject(dto);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'system.create',
        expect.objectContaining({ title: expect.any(String) }),
      );
    });

    it('should translate a unique-violation (23505) into ConflictException', async () => {
      (repository.save as jest.Mock).mockRejectedValue({ code: '23505' });

      await expect(service.create({ name: 'dup' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAllPaginated', () => {
    it('should default to createdAt DESC ordering', async () => {
      await service.findAllPaginated(1, 10);
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });

    it('should honour the provided sort field and direction', async () => {
      await service.findAllPaginated(1, 10, undefined, 'name', 'ASC');
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { name: 'ASC' } }),
      );
    });

    it('should compute pagination meta from the total count', async () => {
      (repository.findAndCount as jest.Mock).mockResolvedValue([[], 25]);

      const result = await service.findAllPaginated(2, 10);

      expect(result.meta).toEqual({ total: 25, page: 2, lastPage: 3 });
    });
  });

  describe('remove', () => {
    it('should soft-remove the entity and emit system.delete', async () => {
      const permission = { id: 1, name: 'users.read' } as Permission;
      (repository.findOne as jest.Mock).mockResolvedValue(permission);

      await service.remove(1);

      expect(repository.softRemove).toHaveBeenCalledWith(permission);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'system.delete',
        expect.any(Object),
      );
    });
  });
});
