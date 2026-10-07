import {
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { PaginationParamsDto } from '../common/dto/pagination-params.dto';
import type { IAuthRequest } from '../auth/interfaces/auth-request.interface';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notifications' })
  @ApiResponse({ status: 200, type: [Notification] })
  findAll(@Query() params: PaginationParamsDto, @Req() req: IAuthRequest) {
    return this.notificationsService.findAllForUser(
      req.user.userId,
      req.user.roles,
      params.page,
      params.limit,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  @ApiResponse({ status: 200, type: Number })
  getUnreadCount(@Req() req: IAuthRequest) {
    return this.notificationsService.getUnreadCount(
      req.user.userId,
      req.user.roles,
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200 })
  markAsRead(@Param('id') id: string, @Req() req: IAuthRequest) {
    return this.notificationsService.markAsReadForUser(
      +id,
      req.user.userId,
      req.user.roles,
    );
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200 })
  markAllAsRead(@Req() req: IAuthRequest) {
    return this.notificationsService.markAllAsRead(
      req.user.userId,
      req.user.roles,
    );
  }
}
