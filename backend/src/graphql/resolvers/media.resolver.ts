import { ForbiddenException, UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { Permissions } from '@/auth/permissions.decorator';
import { MediaService } from '@/media/media.service';
import { Media } from '@/media/entities/media.entity';
import { MediaDeletionResultDto } from '@/media/dto/media-deletion.dto';
import { GqlCurrentUser } from '../decorators/gql-current-user.decorator';
import type { AuthenticatedUser } from '@/auth/interfaces/auth-request.interface';
import type { PaginationInput } from '../generated/graphql';
import type { IGraphQLContext } from '../dataloaders/dataloader.types';
import { paginationArgs } from '../helpers/pagination.util';

/**
 * GraphQL surface for media metadata. Reuses {@link MediaService} and the same
 * `media.*` authorization as the REST controller: reads/deletes are scoped to
 * the caller's own media unless they hold the `*_all` permission or `superadmin`.
 * File uploads stay REST-only (multipart).
 */
@Resolver('Media')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MediaResolver {
  constructor(private readonly mediaService: MediaService) {}

  private canAccessAll(
    user: AuthenticatedUser,
    allPermission: string,
  ): boolean {
    return (
      (user.roles?.includes('superadmin') ?? false) ||
      (user.permissions?.includes(allPermission) ?? false)
    );
  }

  @Query('media')
  @Permissions('media.read')
  findAll(
    @GqlCurrentUser() user: AuthenticatedUser,
    @Args('pagination') pagination?: PaginationInput,
  ) {
    const [page, limit, search, sort, direction] = paginationArgs(pagination);
    const ownerId = this.canAccessAll(user, 'media.read_all')
      ? undefined
      : user.userId;
    return this.mediaService.findAllMediaPaginated(
      page,
      limit,
      search,
      sort,
      direction,
      ownerId,
    );
  }

  @Query('mediaItem')
  @Permissions('media.read')
  async findOne(
    @GqlCurrentUser() user: AuthenticatedUser,
    @Args('id') id: number,
  ) {
    const media = await this.mediaService.findOne(id);
    if (
      !this.canAccessAll(user, 'media.read_all') &&
      media.userId !== user.userId
    ) {
      throw new ForbiddenException('You do not have access to this media.');
    }
    return media;
  }

  @Mutation('deleteMedia')
  @Permissions('media.delete')
  async remove(
    @GqlCurrentUser() user: AuthenticatedUser,
    @Args('id') id: number,
  ): Promise<boolean> {
    await this.removeWithResult(user, id);
    return true;
  }

  @Mutation('deleteMediaWithResult')
  @Permissions('media.delete')
  async removeWithResult(
    @GqlCurrentUser() user: AuthenticatedUser,
    @Args('id') id: number,
  ): Promise<MediaDeletionResultDto> {
    const media = await this.mediaService.findForDeletion(id);
    if (
      !this.canAccessAll(user, 'media.delete_all') &&
      media.userId !== user.userId
    ) {
      throw new ForbiddenException('You do not have access to this media.');
    }
    return this.mediaService.deleteMedia(id);
  }

  @ResolveField('user')
  user(@Parent() media: Media, @Context() ctx: IGraphQLContext) {
    if (media.user) return media.user;
    if (media.userId == null) return null;
    return ctx.loaders.userById.load(media.userId);
  }
}
