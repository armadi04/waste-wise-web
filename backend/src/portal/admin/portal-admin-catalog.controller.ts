import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CookieCsrfGuard } from '@/auth/cookie-csrf.guard';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import type { IAuthRequest } from '@/auth/interfaces/auth-request.interface';
import { Permissions } from '@/auth/permissions.decorator';
import { PermissionsGuard } from '@/auth/permissions.guard';
import { CacheService } from '@/common/cache/cache.service';
import { BulkDeleteDto } from '@/common/dto/bulk-delete.dto';
import { PaginationParamsDto } from '@/common/dto/pagination-params.dto';
import { BaseService } from '@/common/services/base.service';
import type { ObjectLiteral } from 'typeorm';
import {
  CreatePortalBroadcastDto,
  CreatePortalCityDto,
  CreatePortalCouponCategoryDto,
  PortalAdminContentDto,
  SavePortalContentDto,
  UpdatePortalCityDto,
  UpdatePortalCouponCategoryDto,
} from './dto/admin-catalog.dto';
import {
  PortalBroadcastAdminService,
  PortalCityAdminService,
  PortalContentAdminService,
  PortalCouponCategoryAdminService,
} from './portal-admin-catalog.service';

/** Curated catalog taxonomy, editable site content and customer broadcasts. */
@ApiTags('Portal Admin')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-CSRF-Token',
  required: false,
  description:
    'Required on cookie-authenticated writes; must match the csrfToken cookie',
})
@Controller('portal/admin')
@UseGuards(JwtAuthGuard, CookieCsrfGuard, PermissionsGuard)
export class PortalAdminCatalogController {
  constructor(
    private readonly categories: PortalCouponCategoryAdminService,
    private readonly cities: PortalCityAdminService,
    private readonly content: PortalContentAdminService,
    private readonly broadcasts: PortalBroadcastAdminService,
    private readonly cacheService: CacheService,
  ) {}

  @Get('coupon-categories')
  @Permissions('portal.coupon_categories.read')
  listCategories(@Query() params: PaginationParamsDto) {
    return this.list(this.categories, params);
  }

  @Get('coupon-categories/:id')
  @Permissions('portal.coupon_categories.read')
  getCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categories.findOne(id);
  }

  @Post('coupon-categories')
  @Permissions('portal.coupon_categories.create')
  createCategory(@Body() dto: CreatePortalCouponCategoryDto) {
    return this.mutate(this.categories.create(dto));
  }

  @Patch('coupon-categories/:id')
  @Permissions('portal.coupon_categories.update')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalCouponCategoryDto,
  ) {
    return this.mutate(this.categories.update(id, dto));
  }

  @Delete('coupon-categories/:id')
  @Permissions('portal.coupon_categories.delete')
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.categories.remove(id));
  }

  @Post('coupon-categories/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.coupon_categories.delete')
  bulkDeleteCategories(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.categories.removeMany(dto.ids));
  }

  @Get('cities')
  @Permissions('portal.cities.read')
  listCities(@Query() params: PaginationParamsDto) {
    return this.list(this.cities, params);
  }

  @Get('cities/:id')
  @Permissions('portal.cities.read')
  getCity(@Param('id', ParseIntPipe) id: number) {
    return this.cities.findOne(id);
  }

  @Post('cities')
  @Permissions('portal.cities.create')
  createCity(@Body() dto: CreatePortalCityDto) {
    return this.mutate(this.cities.create(dto));
  }

  @Patch('cities/:id')
  @Permissions('portal.cities.update')
  updateCity(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortalCityDto,
  ) {
    return this.mutate(this.cities.update(id, dto));
  }

  @Delete('cities/:id')
  @Permissions('portal.cities.delete')
  deleteCity(@Param('id', ParseIntPipe) id: number) {
    return this.mutate(this.cities.remove(id));
  }

  @Post('cities/bulk-delete')
  @HttpCode(HttpStatus.OK)
  @Permissions('portal.cities.delete')
  bulkDeleteCities(@Body() dto: BulkDeleteDto) {
    return this.mutate(this.cities.removeMany(dto.ids));
  }

  @Get('content')
  @Permissions('portal.content.read')
  @ApiOkResponse({ type: [PortalAdminContentDto] })
  listContent() {
    return this.content.list();
  }

  @Get('content/:key')
  @Permissions('portal.content.read')
  @ApiOkResponse({ type: PortalAdminContentDto })
  getContent(@Param('key') key: string) {
    return this.content.get(key);
  }

  @Put('content/:key')
  @Permissions('portal.content.update')
  @ApiOkResponse({ type: PortalAdminContentDto })
  saveContent(
    @Param('key') key: string,
    @Body() dto: SavePortalContentDto,
    @Req() req: IAuthRequest,
  ) {
    return this.mutate(this.content.save(key, dto, req.user.userId));
  }

  @Get('broadcasts')
  @Permissions('portal.broadcasts.read')
  listBroadcasts(@Query() params: PaginationParamsDto) {
    return this.list(this.broadcasts, params);
  }

  @Get('broadcasts/:id')
  @Permissions('portal.broadcasts.read')
  getBroadcast(@Param('id', ParseIntPipe) id: number) {
    return this.broadcasts.findOne(id);
  }

  @Post('broadcasts')
  @Permissions('portal.broadcasts.create')
  sendBroadcast(
    @Body() dto: CreatePortalBroadcastDto,
    @Req() req: IAuthRequest,
  ) {
    return this.mutate(this.broadcasts.send(dto, req.user.userId));
  }

  private list<TEntity extends ObjectLiteral>(
    service: BaseService<TEntity>,
    params: PaginationParamsDto,
  ) {
    if (params.paginated)
      return service.findAllPaginated(
        params.page,
        params.limit,
        params.search,
        params.sort,
        params.direction,
      );
    return service.findAll();
  }

  private async mutate<T>(operation: Promise<T>) {
    const result = await operation;
    await this.cacheService.clearKeys('*/portal*');
    return result;
  }
}
