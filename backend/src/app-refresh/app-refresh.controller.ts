import { Controller, Post, UseGuards } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { AppRefreshService } from './app-refresh.service';

@ApiTags('App')
@ApiBearerAuth()
@Controller('app')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AppRefreshController {
  constructor(
    private readonly service: AppRefreshService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post('force-refresh')
  @Permissions('app.force_refresh')
  @ApiOperation({
    summary: 'Tell every connected client to drop its cache and reload',
  })
  @ApiResponse({
    status: 201,
    schema: {
      properties: { issuedAt: { type: 'string', format: 'date-time' } },
    },
  })
  forceRefresh(): { issuedAt: string } {
    const issuedAt = this.service.issue();
    // The gateway is reached through an event, never injected here — see the
    // side-effect rule in CLAUDE.md.
    this.eventEmitter.emit('app.force-refresh', { issuedAt });
    return { issuedAt };
  }
}
