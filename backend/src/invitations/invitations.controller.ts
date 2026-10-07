import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { Invitation } from './entities/invitation.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { CacheService } from '../common/cache/cache.service';
import { PaginationParamsDto } from '../common/dto/pagination-params.dto';
import { BulkDeleteDto } from '../common/dto/bulk-delete.dto';
import type { IAuthRequest } from '../auth/interfaces/auth-request.interface';

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitationsService: InvitationsService,
    private readonly cacheService: CacheService,
  ) {}

  // ─── Admin (authenticated + permissioned) ─────────────────────────────────

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('users.invite')
  @ApiOperation({ summary: 'Generate and send an invite link' })
  @ApiResponse({ status: 201 })
  @UseInterceptors(NoFilesInterceptor())
  async create(@Body() dto: CreateInvitationDto, @Req() req: IAuthRequest) {
    const result = await this.invitationsService.createInvite(dto, req.user);
    await this.cacheService.clearKeys('*/invitations*');
    return result;
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('users.invite')
  @ApiOperation({ summary: 'List invitations' })
  @ApiResponse({ status: 200, type: [Invitation] })
  findAll(@Query() params: PaginationParamsDto) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    if (params.paginated) {
      return this.invitationsService.findAllPaginated(
        page,
        limit,
        params.search,
        params.sort,
        params.direction,
      );
    }
    return this.invitationsService.findAll();
  }

  @Post(':id/resend')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('users.invite')
  @ApiOperation({ summary: 'Resend an invitation email' })
  @ApiResponse({ status: 200, type: Invitation })
  @UseInterceptors(NoFilesInterceptor())
  async resend(@Param('id') id: string) {
    const result = await this.invitationsService.resend(+id);
    await this.cacheService.clearKeys('*/invitations*');
    return result;
  }

  @Post('bulk-delete')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('users.invite')
  @ApiOperation({ summary: 'Revoke multiple invitations' })
  @ApiResponse({ status: 200 })
  async bulkRemove(@Body() dto: BulkDeleteDto) {
    const result = await this.invitationsService.revokeMany(dto.ids);
    await this.cacheService.clearKeys('*/invitations*');
    return result;
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('users.invite')
  @ApiOperation({ summary: 'Revoke an invitation' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id') id: string) {
    await this.invitationsService.revoke(+id);
    await this.cacheService.clearKeys('*/invitations*');
    return { message: 'Invitation revoked.' };
  }

  // ─── Public (token-based) ──────────────────────────────────────────────────

  @Get('accept')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Resolve an invitation by token (prefill)' })
  @ApiResponse({
    status: 200,
    schema: { properties: { email: { type: 'string' } } },
  })
  async getByToken(@Query('token') token: string) {
    if (!token) throw new NotFoundException('Token not provided');
    return this.invitationsService.getByToken(token);
  }

  @Post('accept')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Accept an invitation and create the account' })
  @ApiResponse({
    status: 201,
    schema: { properties: { message: { type: 'string' } } },
  })
  @UseInterceptors(NoFilesInterceptor())
  async accept(@Body() dto: AcceptInvitationDto) {
    const result = await this.invitationsService.acceptInvite(dto);
    await this.cacheService.clearKeys('*/invitations*');
    return result;
  }
}
