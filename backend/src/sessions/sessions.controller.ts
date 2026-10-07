import {
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PaginationParamsDto } from '../common/dto/pagination-params.dto';
import { PaginatedResponseDto } from '../common/services/base.service';
import type { IAuthRequest } from '../auth/interfaces/auth-request.interface';
import { SessionsService } from './sessions.service';
import { UserSession } from './entities/user-session.entity';

class PaginatedSessionResponse extends PaginatedResponseDto<UserSession> {
  @ApiProperty({ type: [UserSession] })
  declare data: UserSession[];
}

class OwnSessionResponse extends UserSession {
  @ApiProperty({ description: 'True for the session making this request' })
  isCurrent: boolean;
}

@ApiTags('Sessions')
@ApiBearerAuth()
@Controller('sessions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  // `me` routes are declared before the `:id` ones so they aren't swallowed by
  // the parameterised paths.

  @Get('me')
  @ApiOperation({ summary: "List the current user's active sessions" })
  @ApiResponse({ status: 200, type: [OwnSessionResponse] })
  async findMine(@Request() req: IAuthRequest): Promise<OwnSessionResponse[]> {
    const sessions = await this.sessionsService.findActiveForUser(
      req.user.userId,
    );
    return sessions.map((session) =>
      Object.assign(session, {
        isCurrent: session.sessionId === req.user.sessionId,
      }),
    );
  }

  @Post('me/revoke-others')
  @ApiOperation({ summary: 'Sign out of every other device' })
  @ApiResponse({
    status: 201,
    schema: { properties: { revoked: { type: 'number' } } },
  })
  revokeOthers(@Request() req: IAuthRequest) {
    return this.sessionsService.revokeOthersForUser(
      req.user.userId,
      req.user.sessionId,
    );
  }

  @Delete('me/:id')
  @ApiOperation({ summary: "Revoke one of the current user's sessions" })
  @ApiResponse({ status: 200, type: UserSession })
  revokeMine(@Request() req: IAuthRequest, @Param('id') id: string) {
    return this.sessionsService.revokeById(+id, req.user.userId);
  }

  @Get()
  @Permissions('sessions.read')
  @ApiOperation({ summary: 'List every session (admin)' })
  @ApiResponse({ status: 200, type: PaginatedSessionResponse })
  findAll(@Request() req: IAuthRequest, @Query() params: PaginationParamsDto) {
    return this.sessionsService.findAllForAdmin(
      params.page || 1,
      params.limit || 10,
      params.search,
      params.sort || 'lastActiveAt',
      params.direction,
      req.user.permissions.includes('users.impersonate'),
    );
  }

  @Delete(':id')
  @Permissions('sessions.delete')
  @ApiOperation({ summary: 'Revoke any session (admin)' })
  @ApiResponse({ status: 200, type: UserSession })
  revoke(@Param('id') id: string) {
    return this.sessionsService.revokeById(+id);
  }
}
