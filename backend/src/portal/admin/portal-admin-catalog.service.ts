import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  ILike,
  In,
  Not,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { BaseService } from '@/common/services/base.service';
import { taxonomySlug } from '@/portal/catalog/catalog-taxonomy';
import {
  deliverCommerceEvents,
  drainCommerceEvents,
  enqueueCommerceEvent,
} from '@/portal/commerce/commerce-events';
import { PortalBroadcast } from '@/portal/customer/entities/portal-broadcast.entity';
import { PortalCity } from '@/portal/catalog/entities/portal-city.entity';
import { PortalContentEntry } from '@/portal/catalog/entities/portal-content-entry.entity';
import { PortalCouponCategory } from '@/portal/catalog/entities/portal-coupon-category.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import {
  PORTAL_CONTENT,
  normalizeContentSections,
  portalContentDefinition,
} from '@/portal/catalog/portal-content.registry';
import {
  CreatePortalBroadcastDto,
  CreatePortalCityDto,
  CreatePortalCouponCategoryDto,
  PortalAdminContentDto,
  SavePortalContentDto,
  UpdatePortalCityDto,
  UpdatePortalCouponCategoryDto,
} from './dto/admin-catalog.dto';

type TaxonomyEntity = ObjectLiteral & {
  id: number;
  name: string;
  slug: string;
};

const exactly = (value: string) =>
  ILike(value.trim().replace(/[\\%_]/g, '\\$&'));

/**
 * Curated name lists whose `name` is copied as text onto catalog records.
 * Names are unique case-insensitively; renames rewrite the copied text in the
 * same transaction and deletion is refused while records still use the name.
 */
abstract class PortalTaxonomyAdminService<
  T extends TaxonomyEntity,
> extends BaseService<T> {
  protected abstract readonly maxSlugLength: number;
  protected abstract rename(
    manager: EntityManager,
    current: T,
    name: string,
  ): Promise<void>;
  protected abstract usage(ids: number[]): Promise<number>;

  override async create(dto: DeepPartial<T>): Promise<T> {
    const name = String((dto as Partial<T>).name ?? '').trim();
    // A soft-deleted entry still owns its name (unique index). Creating it again
    // restores that row with the new details instead of failing as a duplicate.
    const archived = await this.repository.findOne({
      where: { name: exactly(name) } as never,
      withDeleted: true,
    });
    if ((archived as { deletedAt?: Date | null } | null)?.deletedAt) {
      await this.repository.restore((archived as T).id);
      return this.update((archived as T).id, {
        active: true,
        ...dto,
        name,
      });
    }
    await this.assertNameAvailable(name);
    const slug = await this.resolveSlug((dto as Partial<T>).slug ?? name);
    return super.create({ ...dto, name, slug });
  }

  override async update(
    id: number,
    dto: QueryDeepPartialEntity<T>,
  ): Promise<T> {
    const saved = await this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository<T>(this.repository.target);
      const current = await repository.findOne({
        where: { id } as never,
        lock: { mode: 'pessimistic_write' },
      });
      if (!current)
        throw new NotFoundException(`${this.entityName} #${id} not found`);
      const changes = { ...dto } as Partial<T>;
      if (changes.name !== undefined) {
        const name = String(changes.name).trim();
        await this.assertNameAvailable(name, id);
        if (name !== current.name) await this.rename(manager, current, name);
        changes.name = name;
      }
      if (changes.slug !== undefined)
        changes.slug = await this.resolveSlug(changes.slug, id);
      return repository.save(repository.merge(current, changes as never));
    });
    this.eventEmitter?.emit('system.update', {
      title: `${this.entityName} Updated`,
      message: `${this.entityName} #${id} has been updated.`,
      entity: saved,
    });
    return saved;
  }

  override async remove(id: number) {
    await this.assertUnused([id]);
    return super.remove(id);
  }

  override async removeMany(ids: number[]) {
    await this.assertUnused(ids);
    return super.removeMany(ids);
  }

  private async assertUnused(ids: number[]) {
    const count = await this.usage(ids);
    if (count)
      throw new ConflictException(
        `${count} catalog record(s) still use this ${this.entityName}; reassign them or deactivate it instead`,
      );
  }

  private async assertNameAvailable(name: string, excludeId?: number) {
    const where = {
      name: exactly(name),
      ...(excludeId === undefined ? {} : { id: Not(excludeId) }),
    } as never;
    if (await this.repository.exists({ where, withDeleted: true }))
      throw new ConflictException(
        `${this.entityName} "${name}" already exists`,
      );
  }

  private async resolveSlug(value: unknown, excludeId?: number) {
    const slug = taxonomySlug(
      typeof value === 'string' ? value : '',
      this.maxSlugLength,
    );
    if (!slug)
      throw new ConflictException('Slug must contain a letter or number');
    const where = {
      slug,
      ...(excludeId === undefined ? {} : { id: Not(excludeId) }),
    } as never;
    if (await this.repository.exists({ where, withDeleted: true }))
      throw new ConflictException(`${this.entityName} slug already exists`);
    return slug;
  }
}

@Injectable()
export class PortalCouponCategoryAdminService extends PortalTaxonomyAdminService<PortalCouponCategory> {
  protected readonly maxSlugLength = 80;

  constructor(
    @InjectRepository(PortalCouponCategory)
    repository: Repository<PortalCouponCategory>,
  ) {
    super(repository, 'PortalCouponCategory', ['name', 'slug', 'label']);
  }

  override create(dto: CreatePortalCouponCategoryDto) {
    return super.create(dto);
  }

  override update(id: number, dto: UpdatePortalCouponCategoryDto) {
    return super.update(id, dto);
  }

  protected async rename(
    manager: EntityManager,
    current: PortalCouponCategory,
    name: string,
  ) {
    await manager
      .getRepository(PortalCoupon)
      .createQueryBuilder()
      .update()
      .set({ category: name })
      .where('"categoryId" = :id', { id: current.id })
      .execute();
  }

  protected usage(ids: number[]) {
    return this.repository.manager
      .getRepository(PortalCoupon)
      .countBy({ categoryId: In(ids) });
  }
}

@Injectable()
export class PortalCityAdminService extends PortalTaxonomyAdminService<PortalCity> {
  protected readonly maxSlugLength = 100;

  constructor(
    @InjectRepository(PortalCity) repository: Repository<PortalCity>,
  ) {
    super(repository, 'PortalCity', ['name', 'slug']);
  }

  override create(dto: CreatePortalCityDto) {
    return super.create(dto);
  }

  override update(id: number, dto: UpdatePortalCityDto) {
    return super.update(id, dto);
  }

  protected async rename(
    manager: EntityManager,
    current: PortalCity,
    name: string,
  ) {
    for (const entity of [PortalCoupon, PortalEvent])
      await manager
        .getRepository(entity)
        .createQueryBuilder()
        .update()
        .set({ city: name })
        .where('city = :city', { city: current.name })
        .execute();
  }

  protected async usage(ids: number[]) {
    const names = (await this.repository.findBy({ id: In(ids) })).map(
      (city) => city.name,
    );
    if (!names.length) return 0;
    const manager = this.repository.manager;
    const [coupons, events] = await Promise.all([
      manager.getRepository(PortalCoupon).countBy({ city: In(names) }),
      manager.getRepository(PortalEvent).countBy({ city: In(names) }),
    ]);
    return coupons + events;
  }
}

@Injectable()
export class PortalContentAdminService {
  constructor(
    @InjectRepository(PortalContentEntry)
    private readonly entries: Repository<PortalContentEntry>,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  private view(
    key: string,
    entry: PortalContentEntry | null,
  ): PortalAdminContentDto {
    const definition = portalContentDefinition(key);
    return {
      key,
      description: definition.description,
      maxSections: definition.maxSections,
      sectionHeading: definition.sectionHeading,
      saved: Boolean(entry),
      title: entry?.title ?? definition.title,
      summary: entry?.summary ?? '',
      sections: entry?.sections ?? [],
      data: entry?.data ?? {},
      published: entry?.published ?? false,
      updatedAt: entry?.updatedAt ?? new Date(0),
    };
  }

  async list() {
    const entries = await this.entries.find();
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));
    return Object.keys(PORTAL_CONTENT).map((key) =>
      this.view(key, byKey.get(key) ?? null),
    );
  }

  async get(key: string) {
    portalContentDefinition(key);
    return this.view(key, await this.entries.findOneBy({ key }));
  }

  async save(key: string, dto: SavePortalContentDto, actorId: number) {
    const definition = portalContentDefinition(key);
    const sections = normalizeContentSections(definition, dto.sections);
    const data = definition.validateData(dto.data ?? {});
    // The entry and its audit record commit together; the outbox delivers the
    // audit after commit and retries if a listener fails.
    const saved = await this.dataSource.transaction(async (manager) => {
      const entries = manager.getRepository(PortalContentEntry);
      const entry =
        (await entries.findOne({
          where: { key },
          lock: { mode: 'pessimistic_write' },
        })) ?? entries.create({ key });
      Object.assign(entry, {
        title: dto.title.trim(),
        summary: dto.summary?.trim() ?? '',
        sections,
        data,
        published: dto.published,
        updatedById: actorId,
      });
      const result = await entries.save(entry);
      await enqueueCommerceEvent(
        manager,
        `content:${key}:${randomUUID()}`,
        'audit.record',
        {
          action: 'portal.content_update',
          actorId,
          subjectType: 'PortalContentEntry',
          subjectId: key,
          summary: dto.published
            ? 'Portal content published'
            : 'Portal content saved as draft',
        },
      );
      return result;
    });
    await deliverCommerceEvents(this.dataSource, this.events);
    return this.view(key, saved);
  }
}

@Injectable()
export class PortalBroadcastAdminService extends BaseService<PortalBroadcast> {
  private readonly logger = new Logger(PortalBroadcastAdminService.name);

  constructor(
    @InjectRepository(PortalBroadcast) repository: Repository<PortalBroadcast>,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {
    super(repository, 'PortalBroadcast', ['title', 'message']);
  }

  override create(): Promise<PortalBroadcast> {
    return Promise.reject(
      new ConflictException('Use the broadcast send action'),
    );
  }
  override update(): Promise<PortalBroadcast> {
    return Promise.reject(
      new ConflictException('Sent broadcasts cannot be edited'),
    );
  }
  override remove(): Promise<void> {
    return Promise.reject(
      new ConflictException('Sent broadcasts cannot be deleted'),
    );
  }
  override removeMany(): Promise<{ deleted: number }> {
    return Promise.reject(
      new ConflictException('Sent broadcasts cannot be deleted'),
    );
  }

  /**
   * Queues one in-app notification per opted-in customer through the durable
   * outbox (keyed per recipient, so retries never duplicate), then drains it in
   * the background. Customers with notifications disabled are skipped.
   */
  async send(dto: CreatePortalBroadcastDto, actorId: number) {
    const operationKey = `admin:${dto.idempotencyKey}`;
    const existing = await this.repository.findOneBy({ operationKey });
    if (existing) return existing;
    const broadcast = await this.dataSource.transaction(async (manager) => {
      const recipients = manager
        .createQueryBuilder()
        .select('DISTINCT u.id', 'id')
        .from('users', 'u')
        .innerJoin('user_roles', 'ur', 'ur."userId" = u.id')
        .innerJoin('roles', 'r', `r.id = ur."roleId" AND r.name = 'customer'`)
        .where('u."deletedAt" IS NULL')
        .andWhere('u."notificationsEnabled" = true');
      if (dto.audience === 'userIds')
        recipients.andWhere('u.id IN (:...ids)', {
          ids: dto.userIds?.length ? dto.userIds : [0],
        });
      const ids = (await recipients.getRawMany<{ id: number }>()).map((row) =>
        Number(row.id),
      );
      const saved = await manager.getRepository(PortalBroadcast).save(
        manager.getRepository(PortalBroadcast).create({
          operationKey,
          title: dto.title.trim(),
          message: dto.message.trim(),
          link: dto.link ?? null,
          type: dto.type ?? 'info',
          audience: dto.audience,
          userIds: dto.audience === 'userIds' ? (dto.userIds ?? []) : null,
          recipientCount: ids.length,
          createdById: actorId,
        }),
      );
      for (const userId of ids)
        await enqueueCommerceEvent(
          manager,
          `broadcast:${saved.id}:${userId}`,
          'user.notification',
          {
            userId,
            title: saved.title,
            message: saved.message,
            type: saved.type,
            link: saved.link ?? undefined,
            actorId,
          },
        );
      await enqueueCommerceEvent(
        manager,
        `broadcast:${saved.id}`,
        'audit.record',
        {
          action: 'portal.broadcast_send',
          actorId,
          subjectType: 'PortalBroadcast',
          subjectId: String(saved.id),
          summary: 'Customer broadcast sent',
          metadata: { audience: saved.audience, recipientCount: ids.length },
        },
      );
      return saved;
    });
    void drainCommerceEvents(this.dataSource, this.events).catch(
      (error: unknown) =>
        this.logger.warn(
          `Broadcast delivery deferred to the outbox worker: ${String(error)}`,
        ),
    );
    return broadcast;
  }
}
