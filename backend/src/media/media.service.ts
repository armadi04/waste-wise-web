import type { UploadedMultipartFile } from '@nestjs/platform-fastify/multipart';
import { API_BASE_PATH } from '@/config/api-routing';
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindManyOptions,
  ILike,
  FindOptionsWhere,
  IsNull,
} from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Media } from './entities/media.entity';
import { BaseService } from '../common/services/base.service';
import { MediaStorageService } from './storage/media-storage.service';
import { MediaCleanupService, MEDIA_LEASE_MS } from './media-cleanup.service';
import {
  MediaBulkDeleteResultDto,
  MediaDeletionResultDto,
} from './dto/media-deletion.dto';
import { MediaUploadPipe } from './media-upload.pipe';

@Injectable()
export class MediaService extends BaseService<Media> {
  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    private readonly configService: ConfigService,
    private readonly storage: MediaStorageService,
    private readonly cleanup: MediaCleanupService,
    private readonly uploadValidation: MediaUploadPipe,
  ) {
    super(mediaRepository, 'Media', ['filename', 'mimetype']);
  }

  async uploadFile(
    input: UploadedMultipartFile,
    userId: number,
    imageOnly = false,
    isPrivate = false,
  ): Promise<Media> {
    if (!Number.isSafeInteger(userId) || userId < 1)
      throw new ForbiddenException('Media uploads require a user account');
    const file = await this.uploadValidation.transform(input);
    if (imageOnly && !file.mimetype.startsWith('image/'))
      throw new UnsupportedMediaTypeException('An image is required');
    const selection = this.storage.selected;
    const token = randomUUID();
    const key = `media/${userId}/${randomUUID()}`;
    // Reserve a durable identity before any external I/O. Expired reservations are reclaimed.
    const media = await this.mediaRepository.save(
      this.mediaRepository.create({
        filename: file.originalname,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        provider: selection.provider,
        storageProfile: selection.profile,
        storageFingerprint: selection.fingerprint,
        path: key,
        remoteName: key,
        userId,
        isPrivate,
        state: 'pending',
        cleanupAt: new Date(Date.now() + MEDIA_LEASE_MS),
        cleanupLeaseUntil: new Date(Date.now() + MEDIA_LEASE_MS),
        cleanupLeaseToken: token,
      }),
    );
    try {
      const stored = await selection.adapter.upload(
        file,
        media,
        async (reserved) => {
          const result = await this.mediaRepository.update(
            { id: media.id, state: 'pending', cleanupLeaseToken: token },
            { path: reserved.path },
          );
          if (!result.affected) throw new Error('Upload lease no longer owned');
        },
      );
      const baseUrl =
        this.configService.get<string>('APP_URL') || 'http://localhost:3001';
      const updated = await this.mediaRepository.update(
        { id: media.id, state: 'pending', cleanupLeaseToken: token },
        {
          path: stored.path,
          url: `${baseUrl.replace(/\/+$/, '')}${API_BASE_PATH}/media/${media.id}/view`,
          state: 'ready',
          cleanupAt: null,
          cleanupLeaseUntil: null,
          cleanupLeaseToken: null,
        },
      );
      if (!updated.affected) throw new Error('Upload lease no longer owned');
      return await this.findOne(media.id);
    } catch {
      // Wait beyond the bounded provider requests before reclaiming potentially ambiguous uploads.
      await this.mediaRepository
        .update(
          { id: media.id, state: 'pending', cleanupLeaseToken: token },
          {
            cleanupAt: new Date(Date.now() + MEDIA_LEASE_MS),
            cleanupLeaseUntil: null,
            cleanupLeaseToken: null,
            cleanupErrorCode: 'UPLOAD_FAILED',
          },
        )
        .catch(() => undefined);
      throw new ServiceUnavailableException(
        'Upload failed; temporary storage is scheduled for cleanup',
      );
    }
  }

  async getSignedUrl(id: number): Promise<string> {
    const media = await this.findOne(id);
    try {
      return await this.storage.forMedia(media).getSignedUrl(media);
    } catch {
      throw new ServiceUnavailableException('Media storage is unavailable');
    }
  }

  async findForDeletion(id: number): Promise<Media> {
    const media = await this.mediaRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!media) throw new NotFoundException('Media not found');
    return media;
  }

  async deleteMedia(id: number): Promise<MediaDeletionResultDto> {
    return this.cleanup.requestDeletion(id);
  }
  // BaseService signatures remain available to generic callers.
  override async remove(id: number): Promise<void> {
    await this.deleteMedia(id);
  }
  override async removeMany(ids: number[]): Promise<{ deleted: number }> {
    return this.deleteMany(ids);
  }

  async deleteMany(ids: number[]): Promise<MediaBulkDeleteResultDto> {
    const results: MediaDeletionResultDto[] = [];
    for (const id of [...new Set(ids)]) {
      try {
        results.push(await this.deleteMedia(id));
      } catch (error) {
        results.push({
          id,
          status: 'failed',
          code:
            error instanceof NotFoundException ? 'NOT_FOUND' : 'DELETE_FAILED',
        });
      }
    }
    return {
      deleted: results.filter(
        (result) =>
          result.status === 'deleted' || result.status === 'already-deleted',
      ).length,
      queued: results.filter((result) => result.status === 'queued').length,
      failed: results.filter((result) => result.status === 'failed').length,
      results,
    };
  }

  async findAllMediaPaginated(
    page: number,
    limit: number,
    search?: string,
    sort = 'createdAt',
    direction = 'DESC',
    userId?: number,
  ) {
    const currentPage = Math.max(1, page);
    const options: FindManyOptions<Media> = {
      skip: (currentPage - 1) * limit,
      take: limit,
      order: {
        [this.safeSort(sort)]:
          direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
      },
      relations: { user: true },
    };
    const where: FindOptionsWhere<Media> = {
      state: 'ready',
      deletedAt: IsNull(),
      ...(userId !== undefined ? { userId } : {}),
    };
    options.where = search
      ? this.searchFields.map((field) => ({
          ...where,
          [field]: ILike(`%${search}%`),
        }))
      : where;
    const [data, total] = await this.mediaRepository.findAndCount(options);
    return {
      data,
      meta: { total, page: currentPage, lastPage: Math.ceil(total / limit) },
    };
  }
  async findAllMedia(userId?: number): Promise<Media[]> {
    return this.mediaRepository.find({
      where: { state: 'ready', ...(userId !== undefined ? { userId } : {}) },
      relations: { user: true },
    });
  }
  override async findOne(id: number): Promise<Media> {
    const media = await this.mediaRepository.findOne({
      where: { id, state: 'ready' },
      relations: { user: true },
    });
    if (!media) throw new NotFoundException('Media not found');
    return media;
  }
}
