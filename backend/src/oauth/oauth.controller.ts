import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { PaginationParamsDto } from '../common/dto/pagination-params.dto';
import { BulkDeleteDto } from '../common/dto/bulk-delete.dto';
import type { IAuthRequest } from '../auth/interfaces/auth-request.interface';
import { OAuthClientService } from './oauth-client.service';
import { CreateOAuthClientDto } from './dto/create-oauth-client.dto';
import { UpdateOAuthClientDto } from './dto/update-oauth-client.dto';
import { TokenRequestDto } from './dto/token-request.dto';

@ApiTags('OAuth')
@Controller('oauth')
@UseInterceptors(ClassSerializerInterceptor)
export class OAuthController {
  constructor(private readonly oauthClientService: OAuthClientService) {}

  @Post('token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Issue an access token (client_credentials grant)' })
  token(@Body() dto: TokenRequestDto) {
    return this.oauthClientService.issueToken(dto);
  }

  @Post('clients')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @Permissions('oauth.clients.create')
  @ApiOperation({
    summary: 'Register an OAuth client (returns the secret once)',
  })
  create(@Body() dto: CreateOAuthClientDto, @Req() req: IAuthRequest) {
    // Superadmins may grant any scope; everyone else is limited to scopes they
    // themselves hold (enforced in the service).
    const creatorPermissions = req.user.roles?.includes('superadmin')
      ? ['*']
      : (req.user.permissions ?? []);
    return this.oauthClientService.createClient(dto, creatorPermissions);
  }

  @Get('clients')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @Permissions('oauth.clients.read')
  @ApiOperation({ summary: 'List OAuth clients' })
  findAll(@Query() params: PaginationParamsDto) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    if (params.paginated) {
      return this.oauthClientService.findAllPaginated(
        page,
        limit,
        params.search,
        params.sort,
        params.direction,
      );
    }
    return this.oauthClientService.findAll();
  }

  @Get('clients/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @Permissions('oauth.clients.read')
  @ApiOperation({ summary: 'Get an OAuth client by id' })
  findOne(@Param('id') id: string) {
    return this.oauthClientService.findOne(+id);
  }

  @Patch('clients/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @Permissions('oauth.clients.update')
  @ApiOperation({ summary: 'Update an OAuth client' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOAuthClientDto,
    @Req() req: IAuthRequest,
  ) {
    const editorPermissions = req.user.roles?.includes('superadmin')
      ? ['*']
      : (req.user.permissions ?? []);
    return this.oauthClientService.updateClient(+id, dto, editorPermissions);
  }

  @Post('clients/bulk-delete')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @Permissions('oauth.clients.delete')
  @ApiOperation({ summary: 'Revoke (soft-delete) multiple OAuth clients' })
  bulkRemove(@Body() dto: BulkDeleteDto) {
    return this.oauthClientService.removeMany(dto.ids);
  }

  @Delete('clients/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @Permissions('oauth.clients.delete')
  @ApiResponse({ status: 200 })
  @ApiOperation({ summary: 'Revoke (soft-delete) an OAuth client' })
  remove(@Param('id') id: string) {
    return this.oauthClientService.remove(+id);
  }
}
