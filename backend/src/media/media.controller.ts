import type { UploadedMultipartFile } from '@nestjs/platform-fastify/multipart';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
  Req,
  ForbiddenException,
  Res,
  HttpCode,
  HttpStatus,
  ClassSerializerInterceptor,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyReply as Response } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import { MediaService } from './media.service';
import { MediaUploadAdmissionInterceptor } from './media-upload-admission.interceptor';
import { MediaIdPipe } from './dto/media-id.pipe';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { FileInterceptor } from '@nestjs/platform-fastify/multipart';
import { CacheService } from '../common/cache/cache.service';
import { PaginationParamsDto } from '../common/dto/pagination-params.dto';
import {
  MediaBulkDeleteDto,
  MediaBulkDeleteResultDto,
  MediaDeletionResultDto,
} from './dto/media-deletion.dto';
import { Media } from './entities/media.entity';
import type { IAuthRequest } from '../auth/interfaces/auth-request.interface';
import { PaginatedResponseDto } from '../common/services/base.service';
import { Throttle } from '@nestjs/throttler';

class PaginatedMediaResponse extends PaginatedResponseDto<Media> {
  @ApiProperty({ type: [Media] })
  declare data: Media[];
}

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
@UseInterceptors(ClassSerializerInterceptor)
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly cacheService: CacheService,
  ) {}

  @Post('upload')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('media.create')
  @ApiOperation({ summary: 'Upload a new media file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: Media })
  @UseInterceptors(MediaUploadAdmissionInterceptor, FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: UploadedMultipartFile,
    @Req() req: IAuthRequest,
  ) {
    // Photo-report users upload images only; staff with media management
    // rights may still upload documents, video and archives.
    const manager =
      req.user.roles.includes('superadmin') ||
      req.user.permissions.includes('media.read_all');
    const result = await this.mediaService.uploadFile(
      file,
      req.user.userId,
      !manager,
      true, // user uploads are private: served only to the owner and authorized staff
    );
    await this.cacheService.clearKeys('*/media*');
    return result;
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('media.read')
  @ApiOperation({ summary: 'Get all media' })
  @ApiResponse({ status: 200, type: PaginatedMediaResponse })
  // Not cached: the cache is keyed by URL alone, and the result depends on the
  // caller (own files vs media.read_all), so one user's list would be served
  // to another.
  findAll(@Query() params: PaginationParamsDto, @Req() req: IAuthRequest) {
    const page = params.page || 1;
    const limit = params.limit || 10;

    const isAdmin = req.user.roles.includes('superadmin');
    const canReadAll = req.user.permissions.includes('media.read_all');
    const filterUserId = isAdmin || canReadAll ? undefined : req.user.userId;

    if (params.paginated) {
      return this.mediaService.findAllMediaPaginated(
        page,
        limit,
        params.search,
        params.sort,
        params.direction,
        filterUserId,
      );
    }
    return this.mediaService.findAllMedia(filterUserId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('media.read')
  @ApiOperation({ summary: 'Get a media by ID' })
  @ApiResponse({ status: 200, type: Media })
  // Not cached: a cache hit would skip the ownership check below.
  async findOne(
    @Param('id', MediaIdPipe) id: number,
    @Req() req: IAuthRequest,
  ) {
    const media = await this.mediaService.findOne(+id);

    const isAdmin = req.user.roles.includes('superadmin');
    const canReadAll = req.user.permissions.includes('media.read_all');

    if (!isAdmin && !canReadAll && media.userId !== req.user.userId) {
      throw new ForbiddenException('You do not have access to this media');
    }

    return media;
  }

  /**
   * View a media file. Public files (avatars) need no credentials. Private
   * files (report photos and other user uploads) require a session (cookie for
   * the web `<img>`, Bearer for native clients) and the same ownership /
   * permission rule as `/stream`; staff who can read all reports may also view
   * them. Anonymous callers get 401 so ids cannot be enumerated.
   */
  @Get(':id/view')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'View a media file (private files need a session)' })
  async viewFile(
    @Param('id', MediaIdPipe) id: number,
    @Req() req: Partial<IAuthRequest>,
    @Res() res: Response,
  ) {
    const media = await this.mediaService.findOne(+id);
    if (media.isPrivate) {
      const user = req.user;
      if (!user) throw new UnauthorizedException('Sign in to view this media');
      const privileged =
        user.roles.includes('superadmin') ||
        user.permissions.includes('media.read_all') ||
        user.permissions.includes('reports.read.all');
      if (!privileged && media.userId !== user.userId) {
        throw new ForbiddenException('You do not have access to this media');
      }
    }
    const url = await this.mediaService.getSignedUrl(+id);
    return res.redirect(url, 302);
  }

  @Get(':id/stream')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('media.read')
  @ApiOperation({ summary: 'Stream a media file' })
  async streamFile(
    @Param('id', MediaIdPipe) id: number,
    @Req() req: IAuthRequest,
    @Res() res: Response,
  ) {
    const media = await this.mediaService.findOne(+id);

    const isAdmin = req.user.roles.includes('superadmin');
    const canReadAll = req.user.permissions.includes('media.read_all');

    if (!isAdmin && !canReadAll && media.userId !== req.user.userId) {
      throw new ForbiddenException('You do not have access to this media');
    }

    const url = await this.mediaService.getSignedUrl(+id);
    return res.redirect(url, 302);
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('media.delete')
  @ApiOperation({ summary: 'Delete multiple media' })
  @ApiResponse({ status: 200, type: MediaBulkDeleteResultDto })
  async bulkRemove(@Body() dto: MediaBulkDeleteDto, @Req() req: IAuthRequest) {
    const isAdmin = req.user.roles.includes('superadmin');
    const canDeleteAll = req.user.permissions.includes('media.delete_all');

    // Non-privileged users may only bulk-delete their own media; reject the
    // whole batch if any selected id isn't owned (mirrors single delete).
    if (!isAdmin && !canDeleteAll) {
      for (const id of dto.ids) {
        const media = await this.mediaService
          .findForDeletion(id)
          .catch((error: unknown) => {
            if (error instanceof NotFoundException) return null;
            throw error;
          });
        if (!media) continue;
        if (media.userId !== req.user.userId) {
          throw new ForbiddenException(
            'You do not have permission to delete this media',
          );
        }
      }
    }

    const result = await this.mediaService.deleteMany(dto.ids);
    await this.cacheService.clearKeys('*/media*');
    return result;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('media.delete')
  @ApiOperation({ summary: 'Delete a media' })
  @ApiResponse({ status: 200, type: MediaDeletionResultDto })
  async remove(@Param('id', MediaIdPipe) id: number, @Req() req: IAuthRequest) {
    const media = await this.mediaService.findForDeletion(id);

    const isAdmin = req.user.roles.includes('superadmin');
    const canDeleteAll = req.user.permissions.includes('media.delete_all');

    if (!isAdmin && !canDeleteAll && media.userId !== req.user.userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this media',
      );
    }

    const result = await this.mediaService.deleteMedia(id);
    await this.cacheService.clearKeys('*/media*');
    return result;
  }
}
