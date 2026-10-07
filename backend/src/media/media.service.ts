import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindManyOptions,
  ILike,
  In,
  FindOptionsWhere,
} from 'typeorm';
import { Media } from './entities/media.entity';
import { BaseService } from '../common/services/base.service';
import { randomUUID } from 'node:crypto';
import { DepotClient, DepotError, putToS3 } from '@univstekom/depot-sdk';
import { ConfigService } from '@nestjs/config';

const timedFetch: typeof fetch = Object.assign(
  (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
    fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }),
  { preconnect: fetch.preconnect },
);

@Injectable()
export class MediaService extends BaseService<Media> {
  private depot: DepotClient;

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    private readonly configService: ConfigService,
  ) {
    super(mediaRepository, 'Media', ['filename', 'mimetype']);

    this.depot = new DepotClient({
      baseUrl: this.configService.get<string>('DEPOT_BASE_URL')!,
      apiKey: this.configService.get<string>('DEPOT_API_KEY')!,
      fetch: timedFetch,
    });
  }

  async uploadFile(file: Express.Multer.File, userId: number): Promise<Media> {
    // Backend proxies the upload: the SDK presigns, PUTs the bytes straight to
    // S3, then finalizes. The local row is a facade for RBAC/ownership.
    const depotFile = await this.depot.upload({
      body: file.buffer,
      name: file.originalname,
      mime: file.mimetype,
      size: file.size,
      ownerUserId: userId,
    });

    const media = this.mediaRepository.create({
      filename: file.originalname,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: depotFile.s3Key,
      depotFileId: depotFile.id,
      userId,
    });

    const savedMedia = await this.mediaRepository.save(media);

    // Update with local view URL (302-redirects to a Depot signed URL)
    const baseUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    savedMedia.url = `${baseUrl}/api/media/${savedMedia.id}/view`;

    return this.mediaRepository.save(savedMedia);
  }

  /** Reserve a durable cleanup record before sending any avatar bytes. */
  async uploadAvatar(
    file: Pick<Express.Multer.File, 'buffer' | 'size'>,
    userId: number,
  ): Promise<Media> {
    const media = await this.mediaRepository.save(
      this.mediaRepository.create({
        filename: `portal-avatar-${randomUUID()}.jpg`,
        originalName: 'avatar.jpg',
        mimetype: 'image/jpeg',
        size: file.size,
        userId,
        managedAvatar: true,
        cleanupAt: new Date(Date.now() + 60 * 60_000),
      }),
    );
    try {
      const upload = await this.depot.createUpload({
        name: media.filename,
        mime: 'image/jpeg',
        size: file.size,
        ownerUserId: userId,
      });
      media.depotFileId = upload.fileId;
      media.path = upload.s3Key;
      // Persist the remote reservation before PUT; a restart can delete it later.
      await this.mediaRepository.save(media);
      await this.putAvatarBytes(upload.uploadUrl, file.buffer);
      await this.depot.completeUpload(upload.fileId);
      const baseUrl =
        this.configService.get<string>('APP_URL') || 'http://localhost:3000';
      media.url = `${baseUrl}/api/media/${media.id}/view`;
      return await this.mediaRepository.save(media);
    } catch (error) {
      await this.scheduleAvatarCleanup(media.id).catch(() => undefined);
      throw error;
    }
  }

  async putAvatarBytes(url: string, buffer: Buffer): Promise<void> {
    await putToS3(url, buffer, 'image/jpeg', undefined, timedFetch);
  }

  async scheduleAvatarCleanup(id: number): Promise<void> {
    await this.mediaRepository.update(
      { id, managedAvatar: true },
      { cleanupAt: new Date() },
    );
  }

  async deleteAvatarRemote(media: Media): Promise<void> {
    if (!media.managedAvatar) return;
    const ids: number[] = [];
    if (media.depotFileId) ids.push(media.depotFileId);
    else {
      // A crash after presign but before saving its ID leaves no uploaded bytes;
      // recover the pending Depot reservation using its unique persisted name.
      let page = 1;
      let pages: number;
      do {
        const result = await this.depot.list({
          search: media.filename,
          page,
          limit: 100,
        });
        ids.push(
          ...result.data
            .filter(
              (file) =>
                file.name === media.filename &&
                file.ownerUserId === media.userId,
            )
            .map((file) => file.id),
        );
        pages = result.meta.totalPages;
        page += 1;
      } while (page <= pages);
    }
    for (const id of ids) {
      try {
        await this.depot.delete(id);
      } catch (error) {
        if (!(error instanceof DepotError && error.status === 404)) throw error;
      }
    }
  }

  /** Resolve a short-lived Depot signed URL for the underlying object. */
  async getSignedUrl(id: number): Promise<string> {
    const media = await this.findOne(id);
    const { url } = await this.depot.getUrl(media.depotFileId);
    return url;
  }

  override async remove(id: number): Promise<void> {
    const media = await this.findOne(id);
    await super.remove(id);

    // Best-effort remote delete; a missing Depot object must not block the
    // local soft-delete.
    if (media.depotFileId) {
      try {
        await this.depot.delete(media.depotFileId);
      } catch (err) {
        if (!(err instanceof DepotError && err.status === 404)) {
          throw err;
        }
      }
    }
  }

  override async removeMany(ids: number[]): Promise<{ deleted: number }> {
    const medias = await this.mediaRepository.find({ where: { id: In(ids) } });
    if (!medias.length) return { deleted: 0 };

    await this.mediaRepository.softRemove(medias);

    // Best-effort remote delete per object; a missing Depot object must not
    // block the local soft-delete.
    for (const media of medias) {
      if (!media.depotFileId) continue;
      try {
        await this.depot.delete(media.depotFileId);
      } catch (err) {
        if (!(err instanceof DepotError && err.status === 404)) {
          throw err;
        }
      }
    }

    return { deleted: medias.length };
  }

  async findAllMediaPaginated(
    page: number,
    limit: number,
    search?: string,
    sort: string = 'createdAt',
    direction: string = 'DESC',
    userId?: number,
  ) {
    const currentPage = Math.max(1, page);
    const skip = (currentPage - 1) * limit;

    const findOptions: FindManyOptions<Media> = {
      skip,
      take: limit,
      order: {
        [sort]: direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
      },
      relations: { user: true },
    };

    const where: FindOptionsWhere<Media> = {};
    if (userId) {
      where.userId = userId;
    }

    if (search) {
      findOptions.where = this.searchFields.map((field) => ({
        ...where,
        [field]: ILike(`%${search}%`),
      }));
    } else if (userId) {
      findOptions.where = where;
    }

    const [data, total] = await this.mediaRepository.findAndCount(findOptions);

    return {
      data,
      meta: {
        total,
        page: +currentPage,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findAllMedia(userId?: number): Promise<Media[]> {
    if (userId) {
      return this.mediaRepository.find({
        where: { userId },
        relations: { user: true },
      });
    }
    return super.findAll(['user']);
  }

  override async findOne(id: number): Promise<Media> {
    return super.findOne(id, ['user']);
  }
}
