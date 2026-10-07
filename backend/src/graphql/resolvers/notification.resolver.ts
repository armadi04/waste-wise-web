import { UseGuards } from '@nestjs/common';
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
import { NotificationsService } from '@/notifications/notifications.service';
import { Notification } from '@/notifications/entities/notification.entity';
import { GqlCurrentUser } from '../decorators/gql-current-user.decorator';
import type { AuthenticatedUser } from '@/auth/interfaces/auth-request.interface';
import type { PaginationInput } from '../generated/graphql';
import type { IGraphQLContext } from '../dataloaders/dataloader.types';
import { paginationArgs } from '../helpers/pagination.util';

/**
 * GraphQL surface for notifications. Auth-only (no permissions), scoped to the
 * current user — mirrors the REST controller.
 */
@Resolver('Notification')
@UseGuards(JwtAuthGuard)
export class NotificationResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query('myNotifications')
  findAll(
    @GqlCurrentUser() user: AuthenticatedUser,
    @Args('pagination') pagination?: PaginationInput,
  ) {
    const [page, limit] = paginationArgs(pagination);
    return this.notificationsService.findAllForUser(
      user.userId,
      user.roles ?? [],
      page,
      limit,
    );
  }

  @Query('unreadNotificationsCount')
  unreadCount(@GqlCurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnreadCount(
      user.userId,
      user.roles ?? [],
    );
  }

  @Mutation('markNotificationRead')
  markRead(@GqlCurrentUser() user: AuthenticatedUser, @Args('id') id: number) {
    return this.notificationsService.markAsReadForUser(
      id,
      user.userId,
      user.roles ?? [],
    );
  }

  @Mutation('markAllNotificationsRead')
  async markAllRead(
    @GqlCurrentUser() user: AuthenticatedUser,
  ): Promise<number> {
    const result = await this.notificationsService.markAllAsRead(
      user.userId,
      user.roles ?? [],
    );
    return result.affected ?? 0;
  }

  @ResolveField('user')
  user(@Parent() notification: Notification, @Context() ctx: IGraphQLContext) {
    if (notification.user) return notification.user;
    if (notification.userId == null) return null;
    return ctx.loaders.userById.load(notification.userId);
  }
}
