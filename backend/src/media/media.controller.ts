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
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { CacheService } from '../common/cache/cache.service';
import { PaginationParamsDto } from '../common/dto/pagination-params.dto';
import { BulkDeleteDto } from '../common/dto/bulk-delete.dto';
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
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: IAuthRequest,
  ) {
    const result = await this.mediaService.uploadFile(file, req.user.userId);
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
  async findOne(@Param('id') id: string, @Req() req: IAuthRequest) {
    const media = await this.mediaService.findOne(+id);

    const isAdmin = req.user.roles.includes('superadmin');
    const canReadAll = req.user.permissions.includes('media.read_all');

    if (!isAdmin && !canReadAll && media.userId !== req.user.userId) {
      throw new ForbiddenException('You do not have access to this media');
    }

    return media;
  }

  /**
   * Public endpoint to view a media file — unauthenticated so it can be used
   * directly in `<img src>` / browser contexts that cannot send a bearer token.
   * Only NON-private files are served here; private files (isPrivate) must go
   * through the authenticated, ownership-checked `/stream` endpoint, otherwise a
   * caller could read any user's private upload by enumerating the id (IDOR).
   */
  @Get(':id/view')
  @ApiOperation({ summary: 'View a public (non-private) media file' })
  async viewFile(@Param('id') id: string, @Res() res: Response) {
    const media = await this.mediaService.findOne(+id);
    if (media.isPrivate) {
      throw new ForbiddenException(
        'This media is private; use the authenticated stream endpoint.',
      );
    }
    const url = await this.mediaService.getSignedUrl(+id);
    return res.redirect(302, url);
  }

  @Get(':id/stream')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('media.read')
  @ApiOperation({ summary: 'Stream a media file' })
  async streamFile(
    @Param('id') id: string,
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
    return res.redirect(302, url);
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('media.delete')
  @ApiOperation({ summary: 'Delete multiple media' })
  @ApiResponse({ status: 200 })
  async bulkRemove(@Body() dto: BulkDeleteDto, @Req() req: IAuthRequest) {
    const isAdmin = req.user.roles.includes('superadmin');
    const canDeleteAll = req.user.permissions.includes('media.delete_all');

    // Non-privileged users may only bulk-delete their own media; reject the
    // whole batch if any selected id isn't owned (mirrors single delete).
    if (!isAdmin && !canDeleteAll) {
      for (const id of dto.ids) {
        const media = await this.mediaService.findOne(id);
        if (media.userId !== req.user.userId) {
          throw new ForbiddenException(
            'You do not have permission to delete this media',
          );
        }
      }
    }

    const result = await this.mediaService.removeMany(dto.ids);
    await this.cacheService.clearKeys('*/media*');
    return result;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('media.delete')
  @ApiOperation({ summary: 'Delete a media' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id') id: string, @Req() req: IAuthRequest) {
    const media = await this.mediaService.findOne(+id);

    const isAdmin = req.user.roles.includes('superadmin');
    const canDeleteAll = req.user.permissions.includes('media.delete_all');

    if (!isAdmin && !canDeleteAll && media.userId !== req.user.userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this media',
      );
    }

    const result = await this.mediaService.remove(+id);
    await this.cacheService.clearKeys('*/media*');
    return result;
  }
}
