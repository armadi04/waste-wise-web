import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { MediaService } from '../../../src/media/media.service';
import { Media } from '../../../src/media/entities/media.entity';

// The `DepotClient` is constructed inside the MediaService constructor. We let
// the (network-free) constructor run, then swap the private `depot` field for a
// fake before exercising any method.
const mockDepot = {
  upload: jest.fn(),
  getUrl: jest.fn(),
  delete: jest.fn(),
};

describe('MediaService', () => {
  let service: MediaService;
  let repository: Repository<Media>;

  beforeEach(async () => {
    mockDepot.upload.mockReset();
    mockDepot.getUrl.mockReset();
    mockDepot.delete.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: getRepositoryToken(Media),
          useValue: {
            findAndCount: jest.fn().mockResolvedValue([[], 0]),
            create: jest.fn((dto: Partial<Media>) => ({ ...dto })),
            save: jest.fn((entity: Partial<Media>) =>
              Promise.resolve({ id: 1, ...entity }),
            ),
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            findOneBy: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'DEPOT_BASE_URL') return 'https://depot.test';
              if (key === 'DEPOT_API_KEY') return 'mk_test_key';
              if (key === 'APP_URL') return 'http://localhost:3000';
              return null;
            }),
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    repository = module.get<Repository<Media>>(getRepositoryToken(Media));
    (service as unknown as { depot: typeof mockDepot }).depot = mockDepot;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should upload via Depot, persist the row with depotFileId and set a local view URL', async () => {
      const file = {
        originalname: 'pic.png',
        mimetype: 'image/png',
        size: 123,
        buffer: Buffer.from('bytes'),
      } as Express.Multer.File;

      mockDepot.upload.mockResolvedValue({
        id: 42,
        s3Key: 'uploads/pic.png',
      });

      const result = await service.uploadFile(file, 7);

      expect(mockDepot.upload).toHaveBeenCalledWith({
        body: file.buffer,
        name: 'pic.png',
        mime: 'image/png',
        size: 123,
        ownerUserId: 7,
      });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ depotFileId: 42, path: 'uploads/pic.png' }),
      );
      expect(repository.save).toHaveBeenCalledTimes(2);
      expect(result.url).toBe('http://localhost:3000/api/media/1/view');
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when the media is missing', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSignedUrl', () => {
    it('should resolve a Depot signed URL for an existing media row', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        depotFileId: 42,
      });
      mockDepot.getUrl.mockResolvedValue({
        url: 'https://depot.test/signed/42',
      });

      const url = await service.getSignedUrl(1);

      expect(mockDepot.getUrl).toHaveBeenCalledWith(42);
      expect(url).toBe('https://depot.test/signed/42');
    });
  });

  describe('findAllMedia', () => {
    it('should filter by userId when provided', async () => {
      await service.findAllMedia(7);
      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 7 },
        relations: { user: true },
      });
    });

    it('should list all media when no userId is provided', async () => {
      await service.findAllMedia();
      expect(repository.find).toHaveBeenCalledWith({
        relations: { user: true },
      });
    });
  });

  describe('findAllMediaPaginated', () => {
    it('should use default sorting (createdAt DESC)', async () => {
      await service.findAllMediaPaginated(1, 10);
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } }),
      );
    });

    it('should scope the query to a user when a userId filter is given', async () => {
      await service.findAllMediaPaginated(
        1,
        10,
        undefined,
        'filename',
        'ASC',
        7,
      );
      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 7 } }),
      );
    });
  });
});
