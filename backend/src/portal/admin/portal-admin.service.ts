import { In } from 'typeorm';
import { isDeepStrictEqual } from 'node:util';
import { PortalCampaignLedger } from '@/portal/campaigns/entities/portal-campaign-ledger.entity';
import {
  campaignRewardLabel,
  validateCampaignRules,
  campaignRulesEqual,
} from '@/portal/campaigns/campaign-rules';
import {
  assertEventTicketStock,
  lockEventTicket,
} from '@/portal/catalog/event-availability';
import { TimeZoneService } from '@/portal/time-zone/time-zone.service';
import { ScheduleTimeDto } from '@/portal/time-zone/dto/time-zone.dto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import {
  DeepPartial,
  EntityManager,
  ObjectLiteral,
  QueryDeepPartialEntity,
  Repository,
} from 'typeorm';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import { refreshCouponSummary } from '@/portal/catalog/coupon-packages';
import {
  resolveCity,
  resolveCouponCategory,
} from '@/portal/catalog/catalog-taxonomy';
import { BaseService } from '@/common/services/base.service';
import { User } from '@/users/entities/user.entity';
import { PortalBundle } from '@/portal/catalog/entities/portal-bundle.entity';
import { PortalCampaignProgress } from '@/portal/campaigns/entities/portal-campaign-progress.entity';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalEmailOtpChallenge } from '@/portal/auth/entities/portal-email-otp-challenge.entity';
import { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalFaq } from '@/portal/catalog/entities/portal-faq.entity';
import { PortalFollow } from '@/portal/customer/entities/portal-follow.entity';
import { PortalOrderItem } from '@/portal/commerce/entities/portal-order-item.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { PortalReview } from '@/portal/reviews/entities/portal-review.entity';
import { PortalPromoCode } from '@/portal/commerce/entities/portal-promo-code.entity';
import { PortalBookingSlot } from '@/portal/bookings/entities/portal-booking-slot.entity';
import { PortalBooking } from '@/portal/bookings/entities/portal-booking.entity';

function sameBusinessValue(left: unknown, right: unknown): boolean {
  if (left instanceof Date || right instanceof Date) {
    if (left == null || right == null) return left === right;
    return (
      new Date(left as string | Date).getTime() ===
      new Date(right as string | Date).getTime()
    );
  }
  return isDeepStrictEqual(left, right);
}

/** Links a coupon write to its curated category and canonical city name. */
async function applyCouponTaxonomy(
  manager: EntityManager,
  dto: DeepPartial<PortalCoupon>,
) {
  if (dto.category !== undefined) {
    const category = await resolveCouponCategory(manager, dto.category);
    dto.category = category.name;
    dto.categoryId = category.id;
  }
  if (dto.city !== undefined) dto.city = await resolveCity(manager, dto.city);
}

type SluggablePortalEntity = ObjectLiteral & {
  slug: string;
  title: string;
};

abstract class PortalSlugAdminService<
  T extends SluggablePortalEntity,
> extends BaseService<T> {
  override async create(dto: DeepPartial<T>) {
    const customSlug = dto.slug;
    const slug = await this.resolveSlug(customSlug, dto.title);
    return super.create({ ...dto, slug });
  }

  override async update(id: number, dto: QueryDeepPartialEntity<T>) {
    const slugValue = (dto as { slug?: unknown }).slug;
    if (slugValue === undefined) return super.update(id, dto);

    const slug = this.normalizeSlug(slugValue);
    await this.assertSlugAvailable(slug, id);
    return super.update(id, { ...dto, slug });
  }

  protected async resolveSlug(customSlug: unknown, title: unknown) {
    const baseSlug = this.normalizeSlug(customSlug ?? title);
    if (customSlug !== undefined) {
      await this.assertSlugAvailable(baseSlug);
      return baseSlug;
    }

    let suffix = 1;
    let slug = baseSlug;
    while (await this.slugExists(slug)) {
      suffix += 1;
      const suffixValue = `-${suffix}`;
      slug = `${baseSlug.slice(0, 160 - suffixValue.length)}${suffixValue}`;
    }
    return slug;
  }

  protected normalizeSlug(value: unknown) {
    if (typeof value !== 'string') {
      throw new BadRequestException('Slug must be a string');
    }

    const slug = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 160);

    if (!slug) {
      throw new BadRequestException(
        'Slug must contain at least one letter or number',
      );
    }
    return slug;
  }

  protected async assertSlugAvailable(slug: string, excludeId?: number) {
    if (await this.slugExists(slug, excludeId)) {
      throw new ConflictException(`${this.entityName} slug already exists`);
    }
  }

  private async slugExists(slug: string, excludeId?: number) {
    const query = this.repository
      .createQueryBuilder('portal')
      .withDeleted()
      .where('portal.slug = :slug', { slug });

    if (excludeId !== undefined) {
      query.andWhere('portal.id != :excludeId', { excludeId });
    }

    return query.getExists();
  }
}

@Injectable()
export class PortalCouponAdminService extends PortalSlugAdminService<PortalCoupon> {
  constructor(
    @InjectRepository(PortalCoupon) repository: Repository<PortalCoupon>,
    private readonly time: TimeZoneService,
  ) {
    super(repository, 'PortalCoupon', [
      'slug',
      'title',
      'merchant',
      'city',
      'location',
      'category',
      'description',
    ]);
  }
  override async create(dto: DeepPartial<PortalCoupon>) {
    const slug = await this.resolveSlug(dto.slug, dto.title);
    return this.writeCoupon(undefined, { ...dto, slug });
  }

  override async update(
    id: number,
    dto: QueryDeepPartialEntity<PortalCoupon>,
    actorId?: number,
  ) {
    const data = dto as DeepPartial<PortalCoupon>;
    if (data.slug !== undefined) {
      data.slug = this.normalizeSlug(data.slug);
      await this.assertSlugAvailable(data.slug, id);
    }
    return this.writeCoupon(id, data, actorId);
  }

  private async writeCoupon(
    id: number | undefined,
    dto: DeepPartial<PortalCoupon> & ScheduleTimeDto,
    actorId?: number,
  ) {
    let before: Record<string, unknown> | undefined;
    try {
      const saved = await this.repository.manager.transaction(
        async (manager) => {
          const repository = manager.getRepository(PortalCoupon);
          const packagesRepository = manager.getRepository(PortalCouponPackage);
          await applyCouponTaxonomy(manager, dto);
          const { packages: inputs, ...schedule } = dto;
          let fields: DeepPartial<PortalCoupon>;
          let coupon: PortalCoupon;
          if (id !== undefined) {
            coupon = await repository
              .createQueryBuilder('coupon')
              .setLock('pessimistic_write')
              .where('coupon.id = :id', { id })
              .getOneOrFail();
            before = {
              timeZone: coupon.timeZone,
              expiresAt: coupon.expiresAt,
              salesEndsAt: coupon.salesEndsAt,
            };
            fields = await this.time.prepare(
              schedule,
              ['expiresAt', 'salesEndsAt'],
              before,
              manager,
            );
            // Legacy scalar updates apply only to a single default package below.
            const {
              price,
              oldPrice,
              discount,
              stockTotal,
              stockRemaining,
              ...metadata
            } = fields;
            void price;
            void oldPrice;
            void discount;
            void stockTotal;
            void stockRemaining;
            Object.assign(coupon, metadata);
          } else {
            fields = await this.time.prepare(
              schedule,
              ['expiresAt', 'salesEndsAt'],
              undefined,
              manager,
            );
            coupon = repository.create(fields);
          }
          if (coupon.validityDays && !coupon.salesEndsAt)
            throw new ConflictException(
              'Duration vouchers require a sales end',
            );
          if (!coupon.expiresAt && coupon.validityDays && coupon.salesEndsAt)
            coupon.expiresAt = coupon.salesEndsAt;
          if (!coupon.expiresAt)
            throw new ConflictException('Fixed voucher expiry is required');
          if (fields.images?.length) {
            coupon.images = fields.images as PortalCoupon['images'];
            coupon.imageUrl = coupon.images[0].url;
          } else if (fields.imageUrl) {
            coupon.images = [{ url: fields.imageUrl, alt: coupon.title }];
          }
          await repository.save(coupon);
          const existing = await packagesRepository.find({
            where: { couponId: coupon.id },
          });
          const changes =
            inputs ??
            (id === undefined || existing.length === 0
              ? [
                  {
                    name: coupon.title,
                    benefits: coupon.benefits,
                    price: coupon.price,
                    oldPrice: coupon.oldPrice,
                    stockTotal: coupon.stockTotal,
                    stockRemaining: coupon.stockRemaining,
                    active: true,
                  },
                ]
              : undefined);
          if (changes) {
            const seen = new Set<string>();
            for (const [position, input] of changes.entries()) {
              if (input.publicId && seen.has(input.publicId))
                throw new BadRequestException('Duplicate package');
              if (input.publicId) seen.add(input.publicId);
              const current = input.publicId
                ? existing.find((item) => item.publicId === input.publicId)
                : undefined;
              if (input.publicId && !current)
                throw new BadRequestException(
                  'Package does not belong to coupon',
                );
              if (current) {
                const total = input.stockTotal ?? current.stockTotal;
                const used = current.stockTotal - current.stockRemaining;
                if (total < used)
                  throw new ConflictException(
                    'Stock total cannot be lower than issued vouchers',
                  );
                Object.assign(current, {
                  name: input.name,
                  benefits: input.benefits,
                  price: input.price,
                  oldPrice: input.oldPrice ?? null,
                  stockTotal: total,
                  stockRemaining: total - used,
                  position,
                  active: input.active ?? true,
                });
                await packagesRepository.save(current);
              } else {
                await packagesRepository.save(
                  packagesRepository.create({
                    couponId: coupon.id,
                    name: input.name,
                    benefits: input.benefits,
                    price: input.price,
                    oldPrice: input.oldPrice ?? null,
                    stockTotal: input.stockTotal,
                    stockRemaining:
                      id === undefined && !inputs
                        ? coupon.stockRemaining
                        : input.stockTotal,
                    position,
                    active: input.active ?? true,
                    isDefault: existing.length === 0 && position === 0,
                  }),
                );
              }
            }
            for (const item of existing) {
              if (!seen.has(item.publicId))
                await packagesRepository.update(item.id, { active: false });
            }
          } else if (existing.length === 1 && existing[0].isDefault) {
            const item = existing[0];
            const total = fields.stockTotal ?? item.stockTotal;
            const used = item.stockTotal - item.stockRemaining;
            if (total < used)
              throw new ConflictException(
                'Stock total cannot be lower than issued vouchers',
              );
            Object.assign(item, {
              price: fields.price ?? item.price,
              oldPrice:
                fields.oldPrice === undefined ? item.oldPrice : fields.oldPrice,
              stockTotal: total,
              stockRemaining: total - used,
            });
            await packagesRepository.save(item);
          }
          await refreshCouponSummary(manager, coupon);
          return repository.findOneByOrFail({ id: coupon.id });
        },
      );
      if (before && actorId !== undefined)
        this.time.recordChange(
          actorId,
          'coupons',
          saved.id,
          before,
          { timeZone: saved.timeZone, expiresAt: saved.expiresAt },
          dto,
        );
      this.eventEmitter?.emit(
        id === undefined ? 'system.create' : 'system.update',
        {
          title: 'PortalCoupon saved',
          message: 'Coupon gallery and packages updated.',
          entity: saved,
        },
      );
      return saved;
    } catch (error) {
      if (error instanceof Error && error.name === 'EntityNotFoundError')
        throw new NotFoundException('Coupon not found');
      this.handleDbError(error);
    }
  }
}

@Injectable()
export class PortalEventAdminService extends PortalSlugAdminService<PortalEvent> {
  constructor(
    @InjectRepository(PortalEvent) repository: Repository<PortalEvent>,
    private readonly time: TimeZoneService,
  ) {
    super(repository, 'PortalEvent', [
      'slug',
      'title',
      'type',
      'venue',
      'city',
      'description',
    ]);
  }
  override async create(dto: DeepPartial<PortalEvent> & ScheduleTimeDto) {
    dto.city = await resolveCity(this.repository.manager, dto.city);
    return super.create(await this.time.prepare(dto, ['startsAt']));
  }
  override async update(
    id: number,
    dto: QueryDeepPartialEntity<PortalEvent> & ScheduleTimeDto,
    actorId?: number,
  ) {
    if (dto.slug !== undefined) {
      dto.slug = this.normalizeSlug(dto.slug);
      await this.assertSlugAvailable(dto.slug, id);
    }
    let before: Record<string, unknown> = {};
    const saved = await this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(PortalEvent);
      const event = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!event) throw new NotFoundException('Event not found');
      if (dto.city !== undefined)
        dto.city = await resolveCity(manager, dto.city);
      before = { timeZone: event.timeZone, startsAt: event.startsAt };
      const fields = await this.time.prepare(
        dto,
        ['startsAt'],
        before,
        manager,
      );
      Object.assign(event, fields);
      return repository.save(event);
    });
    if (actorId !== undefined)
      this.time.recordChange(
        actorId,
        'events',
        id,
        before,
        { timeZone: saved.timeZone, startsAt: saved.startsAt },
        dto,
      );
    this.eventEmitter?.emit('system.update', {
      title: 'PortalEvent updated',
      entity: saved,
    });
    return saved;
  }
}

@Injectable()
export class PortalEventTicketAdminService extends BaseService<PortalEventTicket> {
  constructor(
    @InjectRepository(PortalEventTicket)
    repository: Repository<PortalEventTicket>,
    @InjectRepository(PortalEvent)
    private readonly eventRepository: Repository<PortalEvent>,
  ) {
    super(repository, 'PortalEventTicket', [
      'name',
      'description',
      'statusLabel',
    ]);
  }

  async findByEvent(eventId: number) {
    await this.requireEvent(eventId);
    return this.repository.find({
      where: { eventId },
      order: { price: 'ASC', name: 'ASC' },
    });
  }

  override async create(dto: Partial<PortalEventTicket>) {
    await this.requireEvent(dto.eventId);
    const stockRemaining = dto.stockRemaining ?? dto.stockTotal;
    assertEventTicketStock(dto.stockTotal, stockRemaining);
    return super.create({ ...dto, stockRemaining });
  }

  override async update(id: number, dto: Partial<PortalEventTicket>) {
    if (dto.eventId !== undefined) await this.requireEvent(dto.eventId);
    const saved = await this.repository.manager.transaction(async (manager) => {
      const ticket = await lockEventTicket(manager, { id });
      if (!ticket)
        throw new NotFoundException(`PortalEventTicket #${id} not found`);
      // Remaining stock is live (checkout moves it), so an edit never writes the
      // value the form loaded. Changing the total shifts remaining by the same
      // amount, keeping tickets already sold or reserved.
      const changes = { ...dto };
      delete changes.stockRemaining;
      if (changes.stockTotal !== undefined) {
        const sold = ticket.stockTotal - ticket.stockRemaining;
        if (changes.stockTotal < sold)
          throw new ConflictException(
            `Total stock cannot go below the ${sold} tickets already sold or reserved`,
          );
        ticket.stockRemaining = changes.stockTotal - sold;
      }
      Object.assign(ticket, changes);
      assertEventTicketStock(ticket.stockTotal, ticket.stockRemaining);
      try {
        return await manager.getRepository(PortalEventTicket).save(ticket);
      } catch (error) {
        this.handleDbError(error);
      }
    });
    this.eventEmitter?.emit('system.update', {
      title: 'PortalEventTicket Updated',
      entity: saved,
    });
    return saved;
  }

  private async requireEvent(eventId: number | undefined) {
    if (!eventId || !(await this.eventRepository.findOneBy({ id: eventId }))) {
      throw new NotFoundException(`PortalEvent #${eventId} not found`);
    }
  }
}

@Injectable()
export class PortalBundleAdminService extends PortalSlugAdminService<PortalBundle> {
  constructor(
    @InjectRepository(PortalBundle) repository: Repository<PortalBundle>,
  ) {
    super(repository, 'PortalBundle', ['slug', 'title', 'description']);
  }

  override async create(dto: Partial<PortalBundle>) {
    await this.validateComponents(dto);
    return super.create({ ...dto, componentsNeedReview: false });
  }
  override async update(id: number, dto: Partial<PortalBundle>) {
    const current = await this.findOne(id);
    if (
      (dto.couponSlug !== undefined &&
        dto.couponSlug !== current.couponSlug &&
        dto.packageId === undefined) ||
      (dto.eventSlug !== undefined &&
        dto.eventSlug !== current.eventSlug &&
        dto.ticketTypeId === undefined)
    )
      throw new ConflictException(
        'Select bundle components again when changing their parent',
      );
    await this.validateComponents({ ...current, ...dto });
    const confirmsComponents = Boolean(
      dto.packageId && dto.ticketTypeId && current.componentsNeedReview,
    );
    return super.update(id, {
      ...dto,
      ...(confirmsComponents ? { componentsNeedReview: false } : {}),
    });
  }
  private async validateComponents(dto: Partial<PortalBundle>) {
    const manager = this.repository.manager;
    if (dto.packageId) {
      const coupon = await manager
        .getRepository(PortalCoupon)
        .findOneBy({ slug: dto.couponSlug, active: true });
      const pack = await manager
        .getRepository(PortalCouponPackage)
        .findOneBy({ id: dto.packageId, active: true });
      if (!coupon || !pack || pack.couponId !== coupon.id)
        throw new ConflictException('Package must belong to the bundle coupon');
    }
    if (dto.ticketTypeId) {
      const event = await manager
        .getRepository(PortalEvent)
        .findOneBy({ slug: dto.eventSlug, active: true });
      const ticket = await manager
        .getRepository(PortalEventTicket)
        .findOneBy({ id: dto.ticketTypeId });
      if (!event || !ticket || ticket.eventId !== event.id)
        throw new ConflictException(
          'Ticket type must belong to the bundle event',
        );
    }
  }
}

@Injectable()
export class PortalCampaignAdminService extends PortalSlugAdminService<PortalCampaign> {
  constructor(
    @InjectRepository(PortalCampaign) repository: Repository<PortalCampaign>,
  ) {
    super(repository, 'PortalCampaign', [
      'slug',
      'title',
      'description',
      'rewardLabel',
    ]);
  }
  override async create(dto: Partial<PortalCampaign>) {
    if (dto.rules) {
      validateCampaignRules(dto.rules, dto.targetPoints!);
      await this.validateProducts(dto.rules, this.repository.manager);
      dto.rewardLabel = campaignRewardLabel(dto.rules);
    }
    return super.create(dto);
  }

  override async update(id: number, dto: Partial<PortalCampaign>) {
    if (dto.slug !== undefined) {
      dto.slug = this.normalizeSlug(dto.slug);
      await this.assertSlugAvailable(dto.slug, id);
    }
    const saved = await this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(PortalCampaign);
      const current = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) throw new NotFoundException('Campaign not found');
      const hasActivity = await manager
        .getRepository(PortalCampaignLedger)
        .countBy({ campaignId: id });
      const verifiedActivity = await manager
        .getRepository(PortalCampaignLedger)
        .createQueryBuilder('l')
        .where('l.campaignId = :id', { id })
        .andWhere('l.kind != :baseline', { baseline: 'baseline' })
        .getCount();
      const ruleChange =
        dto.rules !== undefined &&
        !campaignRulesEqual(dto.rules, current.rules);
      const targetChange =
        dto.targetPoints !== undefined &&
        dto.targetPoints !== current.targetPoints;
      if ((verifiedActivity && ruleChange) || (hasActivity && targetChange))
        throw new ConflictException(
          'Campaign rules and target are frozen after activity',
        );
      Object.assign(current, dto);
      if (current.rules) {
        validateCampaignRules(current.rules, current.targetPoints);
        await this.validateProducts(current.rules, manager);
        current.rewardLabel = campaignRewardLabel(current.rules);
      }
      return repository.save(current);
    });
    this.eventEmitter?.emit('system.update', {
      title: 'PortalCampaign updated',
      entity: saved,
    });
    return saved;
  }

  private async validateProducts(
    rules: import('@/portal/campaigns/campaign-rules').CampaignRules,
    manager: import('typeorm').EntityManager,
  ) {
    const coupons = [...new Set(rules.couponIds)];
    const events = [...new Set(rules.eventIds)];
    if (
      (coupons.length &&
        (await manager
          .getRepository(PortalCoupon)
          .countBy({ id: In(coupons) })) !== coupons.length) ||
      (events.length &&
        (await manager
          .getRepository(PortalEvent)
          .countBy({ id: In(events) })) !== events.length)
    )
      throw new BadRequestException('Campaign references unknown products');
  }
}

@Injectable()
export class PortalFaqAdminService extends BaseService<PortalFaq> {
  constructor(@InjectRepository(PortalFaq) repository: Repository<PortalFaq>) {
    super(repository, 'PortalFaq', ['question', 'answer']);
  }
}

@Injectable()
export class PortalVoucherAdminService extends BaseService<PortalVoucher> {
  constructor(
    @InjectRepository(PortalVoucher) repository: Repository<PortalVoucher>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(PortalCoupon)
    private readonly couponRepository: Repository<PortalCoupon>,
  ) {
    super(repository, 'PortalVoucher', ['code', 'status']);
  }

  override async create(dto: Partial<PortalVoucher>) {
    if (dto.status && !['Issued', 'Reserved'].includes(dto.status))
      throw new BadRequestException('Use the verified usage endpoint');
    await this.requireUser(dto.userId);
    const coupon = await this.requireCoupon(dto.couponId);
    return super.create({ ...dto, timeZone: coupon.timeZone });
  }

  override async update(id: number, dto: Partial<PortalVoucher>) {
    try {
      const saved = await this.repository.manager.transaction(
        async (manager) => {
          const repository = manager.getRepository(PortalVoucher);
          const current = await repository.findOne({
            where: { id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!current)
            throw new NotFoundException(`${this.entityName} #${id} not found`);
          const changes = { ...dto };
          for (const key of [
            'status',
            'userId',
            'couponId',
            'redeemedAt',
            'expiresAt',
          ] as const) {
            if (changes[key] === undefined) continue;
            if (
              key === 'status' ||
              key === 'redeemedAt' ||
              current.orderItemId
            ) {
              if (!sameBusinessValue(changes[key], current[key]))
                throw new ConflictException(
                  key === 'status'
                    ? 'Use the verified usage endpoint'
                    : 'Linked resource business fields cannot be edited',
                );
              delete changes[key];
            }
          }
          if (changes.userId !== undefined)
            await this.requireUser(changes.userId);
          if (changes.couponId !== undefined)
            await this.requireCoupon(changes.couponId);
          if (Object.keys(changes).length) await repository.update(id, changes);
          return repository.findOneByOrFail({ id });
        },
      );
      this.eventEmitter?.emit('system.update', {
        title: `${this.entityName} Updated`,
        message: `${this.entityName} #${id} has been updated.`,
        entity: saved,
      });
      return saved;
    } catch (error) {
      this.handleDbError(error);
    }
  }

  override async remove(id: number) {
    const current = await this.findOne(id);
    if (current.orderItemId)
      throw new ConflictException('Linked resource cannot be deleted');
    return super.remove(id);
  }

  override async removeMany(ids: number[]) {
    if (
      (await this.repository.findBy({ id: In(ids) })).some(
        (row) => row.orderItemId,
      )
    )
      throw new ConflictException('Linked resources cannot be deleted');
    return super.removeMany(ids);
  }

  private async requireUser(userId: number | undefined) {
    if (!userId || !(await this.userRepository.findOneBy({ id: userId }))) {
      throw new NotFoundException(`User #${userId} not found`);
    }
  }

  private async requireCoupon(couponId: number | undefined) {
    const coupon = couponId
      ? await this.couponRepository.findOneBy({ id: couponId })
      : null;
    if (!coupon)
      throw new NotFoundException(`PortalCoupon #${couponId} not found`);
    return coupon;
  }
}

@Injectable()
export class PortalTicketAdminService extends BaseService<PortalTicket> {
  constructor(
    @InjectRepository(PortalTicket) repository: Repository<PortalTicket>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(PortalEvent)
    private readonly eventRepository: Repository<PortalEvent>,
    @InjectRepository(PortalEventTicket)
    private readonly eventTicketRepository: Repository<PortalEventTicket>,
  ) {
    super(repository, 'PortalTicket', ['code', 'attendee', 'status']);
  }

  override async create(dto: Partial<PortalTicket>) {
    if (dto.status && !['Issued', 'Reserved'].includes(dto.status))
      throw new BadRequestException('Use the verified usage endpoint');
    await this.validateRelations(dto);
    return super.create(dto);
  }

  override async update(id: number, dto: Partial<PortalTicket>) {
    try {
      const saved = await this.repository.manager.transaction(
        async (manager) => {
          const repository = manager.getRepository(PortalTicket);
          const current = await repository.findOne({
            where: { id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!current)
            throw new NotFoundException(`${this.entityName} #${id} not found`);
          const changes = { ...dto };
          for (const key of [
            'status',
            'userId',
            'eventId',
            'ticketTypeId',
            'checkedInAt',
          ] as const) {
            if (changes[key] === undefined) continue;
            if (
              key === 'status' ||
              key === 'checkedInAt' ||
              current.orderItemId
            ) {
              if (!sameBusinessValue(changes[key], current[key]))
                throw new ConflictException(
                  key === 'status'
                    ? 'Use the verified usage endpoint'
                    : 'Linked resource business fields cannot be edited',
                );
              delete changes[key];
            }
          }
          await this.validateRelations(changes);
          if (Object.keys(changes).length) await repository.update(id, changes);
          return repository.findOneByOrFail({ id });
        },
      );
      this.eventEmitter?.emit('system.update', {
        title: `${this.entityName} Updated`,
        message: `${this.entityName} #${id} has been updated.`,
        entity: saved,
      });
      return saved;
    } catch (error) {
      this.handleDbError(error);
    }
  }

  override async remove(id: number) {
    const current = await this.findOne(id);
    if (current.orderItemId)
      throw new ConflictException('Linked resource cannot be deleted');
    return super.remove(id);
  }

  override async removeMany(ids: number[]) {
    if (
      (await this.repository.findBy({ id: In(ids) })).some(
        (row) => row.orderItemId,
      )
    )
      throw new ConflictException('Linked resources cannot be deleted');
    return super.removeMany(ids);
  }

  private async validateRelations(dto: Partial<PortalTicket>) {
    if (
      dto.userId !== undefined &&
      !(await this.userRepository.findOneBy({ id: dto.userId }))
    ) {
      throw new NotFoundException(`User #${dto.userId} not found`);
    }
    if (
      dto.eventId !== undefined &&
      !(await this.eventRepository.findOneBy({ id: dto.eventId }))
    ) {
      throw new NotFoundException(`PortalEvent #${dto.eventId} not found`);
    }
    if (
      dto.ticketTypeId !== undefined &&
      !(await this.eventTicketRepository.findOneBy({ id: dto.ticketTypeId }))
    ) {
      throw new NotFoundException(
        `PortalEventTicket #${dto.ticketTypeId} not found`,
      );
    }
  }
}

@Injectable()
export class PortalOrderAdminService extends BaseService<PortalOrder> {
  constructor(
    @InjectRepository(PortalOrder) repository: Repository<PortalOrder>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    super(repository, 'PortalOrder', [
      'orderNumber',
      'status',
      'kind',
      'title',
      'meta',
    ]);
  }

  override create(dto: Partial<PortalOrder>): Promise<PortalOrder> {
    void dto;
    return Promise.reject(
      new ConflictException('Orders must be created through checkout'),
    );
  }

  override async update(id: number, dto: Partial<PortalOrder>) {
    if (
      Object.keys(dto).some((key) =>
        [
          'status',
          'userId',
          'total',
          'paidAt',
          'refundStatus',
          'refundedAt',
          'promoCode',
          'subtotal',
          'discount',
          'paymentMethod',
          'paymentReference',
          'paymentExpiresAt',
          'virtualAccount',
          'cashbackAmount',
          'idempotencyKey',
          'orderNumber',
          'currency',
          'kind',
          'refundReason',
          'refundRequestedAt',
        ].includes(key),
      )
    )
      throw new ConflictException(
        'Order financial state cannot be edited directly',
      );
    if (dto.userId !== undefined) await this.requireUser(dto.userId);
    return super.update(id, dto);
  }

  override remove(_id: number): Promise<void> {
    void _id;
    return Promise.reject(
      new ConflictException('Use order cancellation or refund'),
    );
  }
  override removeMany(_ids: number[]): Promise<{ deleted: number }> {
    void _ids;
    return Promise.reject(
      new ConflictException('Use order cancellation or refund'),
    );
  }

  private async requireUser(userId: number | undefined) {
    if (!userId || !(await this.userRepository.findOneBy({ id: userId }))) {
      throw new NotFoundException(`User #${userId} not found`);
    }
  }
}

@Injectable()
export class PortalOrderItemAdminService extends BaseService<PortalOrderItem> {
  constructor(
    @InjectRepository(PortalOrderItem)
    repository: Repository<PortalOrderItem>,
    @InjectRepository(PortalOrder)
    private readonly orderRepository: Repository<PortalOrder>,
  ) {
    super(repository, 'PortalOrderItem', ['productType', 'title']);
  }

  async findByOrder(orderId: number) {
    await this.requireOrder(orderId);
    return this.repository.find({ where: { orderId }, order: { id: 'ASC' } });
  }

  override create(dto: Partial<PortalOrderItem>): Promise<PortalOrderItem> {
    void dto;
    return Promise.reject(
      new ConflictException('Order items must be created through checkout'),
    );
  }

  override async update(id: number, dto: Partial<PortalOrderItem>) {
    const current = await this.findOne(id);
    const order = await this.orderRepository.findOneBy({ id: current.orderId });
    if (
      order?.paidAt ||
      Object.keys(dto).some((key) =>
        [
          'orderId',
          'productId',
          'productType',
          'packageId',
          'packageSnapshot',
          'quantity',
          'unitPrice',
        ].includes(key),
      )
    )
      throw new ConflictException(
        'Order item business fields cannot be edited',
      );
    if (dto.orderId !== undefined) await this.requireOrder(dto.orderId);
    return super.update(id, dto);
  }

  override remove(_id: number): Promise<void> {
    void _id;
    return Promise.reject(
      new ConflictException('Order items cannot be deleted'),
    );
  }
  override removeMany(_ids: number[]): Promise<{ deleted: number }> {
    void _ids;
    return Promise.reject(
      new ConflictException('Order items cannot be deleted'),
    );
  }

  private async requireOrder(orderId: number | undefined) {
    if (!orderId || !(await this.orderRepository.findOneBy({ id: orderId }))) {
      throw new NotFoundException(`PortalOrder #${orderId} not found`);
    }
  }
}

@Injectable()
export class PortalFollowAdminService extends BaseService<PortalFollow> {
  constructor(
    @InjectRepository(PortalFollow) repository: Repository<PortalFollow>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    super(repository, 'PortalFollow', [
      'targetType',
      'targetKey',
      'targetName',
    ]);
  }

  override async create(dto: Partial<PortalFollow>) {
    await this.requireUser(dto.userId);
    return super.create(dto);
  }

  override async update(id: number, dto: Partial<PortalFollow>) {
    if (dto.userId !== undefined) await this.requireUser(dto.userId);
    return super.update(id, dto);
  }

  private async requireUser(userId: number | undefined) {
    if (!userId || !(await this.userRepository.findOneBy({ id: userId }))) {
      throw new NotFoundException(`User #${userId} not found`);
    }
  }
}

@Injectable()
export class PortalCampaignProgressAdminService extends BaseService<PortalCampaignProgress> {
  constructor(
    @InjectRepository(PortalCampaignProgress)
    repository: Repository<PortalCampaignProgress>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(PortalCampaign)
    private readonly campaignRepository: Repository<PortalCampaign>,
  ) {
    super(repository, 'PortalCampaignProgress', ['status']);
  }

  override create(
    _dto: Partial<PortalCampaignProgress>,
  ): Promise<PortalCampaignProgress> {
    void _dto;
    return Promise.reject(
      new ConflictException('Use campaign point adjustments'),
    );
  }
  override update(
    _id: number,
    _dto: Partial<PortalCampaignProgress>,
  ): Promise<PortalCampaignProgress> {
    void _id;
    void _dto;
    return Promise.reject(
      new ConflictException('Use campaign point adjustments'),
    );
  }
  override remove(_id: number): Promise<void> {
    void _id;
    return Promise.reject(
      new ConflictException(
        'Campaign progress is immutable outside the ledger',
      ),
    );
  }
  override removeMany(_ids: number[]): Promise<{ deleted: number }> {
    void _ids;
    return Promise.reject(
      new ConflictException(
        'Campaign progress is immutable outside the ledger',
      ),
    );
  }
}

@Injectable()
export class PortalOtpAdminService extends BaseService<PortalEmailOtpChallenge> {
  constructor(
    @InjectRepository(PortalEmailOtpChallenge)
    repository: Repository<PortalEmailOtpChallenge>,
  ) {
    super(repository, 'PortalEmailOtpChallenge', [
      'email',
      'purpose',
      'requestIp',
    ]);
  }

  override async create(dto: Partial<PortalEmailOtpChallenge>) {
    const codeHash = createHash('sha256').update(randomUUID()).digest('hex');
    const entity = await super.create({ ...dto, codeHash });
    return this.safe(entity);
  }

  override async update(id: number, dto: Partial<PortalEmailOtpChallenge>) {
    const entity = await super.update(id, dto);
    return this.safe(entity);
  }

  override async findOne(id: number) {
    return this.safe(await super.findOne(id));
  }

  override async findAll(relations: string[] = []) {
    const rows = await super.findAll(relations);
    return rows.map((row) => this.safe(row));
  }

  override async findAllPaginated(
    page = 1,
    limit = 10,
    search?: string,
    sort = 'createdAt',
    direction = 'DESC',
  ) {
    const result = await super.findAllPaginated(
      page,
      limit,
      search,
      sort,
      direction,
    );
    return { ...result, data: result.data.map((row) => this.safe(row)) };
  }

  private safe(row: PortalEmailOtpChallenge) {
    return { ...row, codeHash: undefined as unknown as string };
  }
}

@Injectable()
export class PortalReviewAdminService extends BaseService<PortalReview> {
  constructor(
    @InjectRepository(PortalReview) repository: Repository<PortalReview>,
  ) {
    super(repository, 'PortalReview', [
      'targetType',
      'targetKey',
      'authorName',
      'body',
      'merchantReply',
    ]);
  }
}

@Injectable()
export class PortalPromoCodeAdminService extends BaseService<PortalPromoCode> {
  constructor(
    @InjectRepository(PortalPromoCode) repository: Repository<PortalPromoCode>,
  ) {
    super(repository, 'PortalPromoCode', ['code', 'kind']);
  }

  override async create(dto: Partial<PortalPromoCode>) {
    const code = this.normalizeCode(dto.code);
    await this.assertCodeAvailable(code);
    this.validateDiscount(dto.kind, dto.value);
    return super.create({
      ...dto,
      code,
      minimumOrder: dto.minimumOrder ?? 0,
      maximumDiscount: dto.maximumDiscount ?? null,
      usageLimit: dto.usageLimit ?? null,
    });
  }

  override async update(
    id: number,
    dto: QueryDeepPartialEntity<PortalPromoCode>,
  ) {
    if ((await this.findOne(id)).campaignId)
      throw new ConflictException(
        'Campaign rewards are managed by the campaign engine',
      );
    const codeValue = (dto as { code?: unknown }).code;
    const kindValue = (dto as { kind?: unknown }).kind;
    const value = (dto as { value?: unknown }).value;
    if (codeValue !== undefined) {
      const code = this.normalizeCode(codeValue);
      await this.assertCodeAvailable(code, id);
      (dto as { code: string }).code = code;
    }
    if (kindValue !== undefined || value !== undefined) {
      const current = await this.findOne(id);
      this.validateDiscount(
        typeof kindValue === 'string' ? kindValue : current.kind,
        typeof value === 'number' ? value : current.value,
      );
    }
    return super.update(id, dto);
  }

  override async remove(id: number) {
    if ((await this.findOne(id)).campaignId)
      throw new ConflictException('Campaign rewards cannot be deleted');
    return super.remove(id);
  }
  override async removeMany(ids: number[]) {
    if (
      (await this.repository.findBy({ id: In(ids) })).some(
        (row) => row.campaignId,
      )
    )
      throw new ConflictException('Campaign rewards cannot be deleted');
    return super.removeMany(ids);
  }

  private normalizeCode(value: unknown) {
    if (typeof value !== 'string' || value.trim().length < 3)
      throw new BadRequestException(
        'Promo code must contain at least 3 characters',
      );
    return value.trim().toUpperCase();
  }

  private validateDiscount(kind: unknown, value: unknown) {
    if (kind === 'percentage' && (typeof value !== 'number' || value > 100))
      throw new BadRequestException('Percentage promo value cannot exceed 100');
  }

  private async assertCodeAvailable(code: string, excludeId?: number) {
    const query = this.repository
      .createQueryBuilder('promo')
      .withDeleted()
      .where('promo.code = :code', { code });
    if (excludeId !== undefined)
      query.andWhere('promo.id != :excludeId', { excludeId });
    if (await query.getExists())
      throw new ConflictException('Promo code already exists');
  }
}

@Injectable()
export class PortalBookingSlotAdminService extends BaseService<PortalBookingSlot> {
  constructor(
    @InjectRepository(PortalBookingSlot)
    repository: Repository<PortalBookingSlot>,
    private readonly time: TimeZoneService,
  ) {
    super(repository, 'PortalBookingSlot', ['status']);
  }

  override async create(dto: Partial<PortalBookingSlot> & ScheduleTimeDto) {
    return this.write(undefined, dto);
  }
  override async update(
    id: number,
    dto: Partial<PortalBookingSlot> & ScheduleTimeDto,
  ) {
    return this.write(id, dto);
  }
  private async write(
    id: number | undefined,
    dto: Partial<PortalBookingSlot> & ScheduleTimeDto,
  ) {
    const saved = await this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(PortalBookingSlot);
      const current =
        id === undefined
          ? null
          : await repository.findOne({
              where: { id },
              lock: { mode: 'pessimistic_write' },
            });
      if (id !== undefined && !current)
        throw new NotFoundException('Booking slot not found');
      const eventId = dto.eventId ?? current?.eventId;
      const event = eventId
        ? await manager.getRepository(PortalEvent).findOne({
            where: { id: eventId },
            lock: { mode: 'pessimistic_read' },
          })
        : null;
      if (!event) throw new NotFoundException('Event not found');
      if (dto.timeZone && dto.timeZone !== event.timeZone)
        throw new BadRequestException('Slot timezone must match its event');
      const fields = await this.time.prepare(
        { ...dto, timeZone: event.timeZone },
        ['startsAt', 'endsAt'],
        undefined,
        manager,
      );
      delete fields.timeZone;
      // Remaining seats are live (bookings move them), so an edit never writes
      // the value the form loaded: a capacity change shifts remaining by the
      // same amount, keeping seats already booked.
      if (current) delete fields.remaining;
      const slot = repository.create({
        ...current,
        ...fields,
      } as Partial<PortalBookingSlot>);
      if (current && typeof fields.capacity === 'number') {
        const booked = current.capacity - current.remaining;
        if (fields.capacity < booked)
          throw new ConflictException(
            `Capacity cannot go below the ${booked} seats already booked`,
          );
        slot.remaining = fields.capacity - booked;
      }
      slot.remaining ??= slot.capacity;
      // Closed is an admin choice; Full/Available follow the seats left.
      if (slot.status !== 'Closed')
        slot.status = slot.remaining > 0 ? 'Available' : 'Full';
      if (
        !slot.capacity ||
        slot.capacity < 1 ||
        slot.remaining < 0 ||
        slot.remaining > slot.capacity
      )
        throw new BadRequestException('Invalid slot capacity');
      if (
        !slot.startsAt ||
        !slot.endsAt ||
        slot.endsAt.getTime() <= slot.startsAt.getTime()
      )
        throw new BadRequestException('Slot end must follow start');
      try {
        return await repository.save(slot);
      } catch (error) {
        this.handleDbError(error);
      }
    });
    this.eventEmitter?.emit(
      id === undefined ? 'system.create' : 'system.update',
      { title: 'PortalBookingSlot saved', entity: saved },
    );
    return saved;
  }
}

// Booking statuses that occupy a seat in their slot.
const SEAT_HOLDING_BOOKING = ['Reserved', 'Confirmed', 'Completed'];

@Injectable()
export class PortalBookingAdminService extends BaseService<PortalBooking> {
  constructor(
    @InjectRepository(PortalBooking) repository: Repository<PortalBooking>,
  ) {
    super(repository, 'PortalBooking', ['attendee', 'status']);
  }

  /**
   * Admin status changes move the slot's seat count like the customer flow:
   * cancelling returns the seat, reinstating takes one (refused when full).
   */
  override async update(
    id: number,
    dto: Partial<PortalBooking>,
  ): Promise<PortalBooking> {
    return this.repository.manager.transaction(async (manager) => {
      const booking = await this.lockBooking(manager, id);
      if (dto.status !== undefined && dto.status !== booking.status) {
        const held = SEAT_HOLDING_BOOKING.includes(booking.status);
        const holds = SEAT_HOLDING_BOOKING.includes(dto.status);
        if (held !== holds)
          await this.moveSeat(manager, booking.slotId, holds ? -1 : 1);
      }
      Object.assign(booking, dto);
      return manager.getRepository(PortalBooking).save(booking);
    });
  }

  override async remove(id: number): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      const booking = await this.lockBooking(manager, id);
      await this.releaseAndRemove(manager, [booking]);
    });
  }

  override async removeMany(ids: number[]): Promise<{ deleted: number }> {
    return this.repository.manager.transaction(async (manager) => {
      const bookings = await manager
        .getRepository(PortalBooking)
        .createQueryBuilder('booking')
        .setLock('pessimistic_write')
        .where('booking.id IN (:...ids)', { ids: ids.length ? ids : [0] })
        .orderBy('booking.id')
        .getMany();
      await this.releaseAndRemove(manager, bookings);
      return { deleted: bookings.length };
    });
  }

  private async lockBooking(manager: EntityManager, id: number) {
    const booking = await manager
      .getRepository(PortalBooking)
      .createQueryBuilder('booking')
      .setLock('pessimistic_write')
      .where('booking.id = :id', { id })
      .getOne();
    if (!booking) throw new NotFoundException(`PortalBooking #${id} not found`);
    return booking;
  }

  private async releaseAndRemove(
    manager: EntityManager,
    bookings: PortalBooking[],
  ) {
    for (const booking of bookings) {
      if (SEAT_HOLDING_BOOKING.includes(booking.status))
        await this.moveSeat(manager, booking.slotId, 1);
    }
    if (bookings.length)
      await manager.getRepository(PortalBooking).softRemove(bookings);
  }

  private async moveSeat(
    manager: EntityManager,
    slotId: number,
    delta: 1 | -1,
  ) {
    const slots = manager.getRepository(PortalBookingSlot);
    const slot = await slots
      .createQueryBuilder('slot')
      .setLock('pessimistic_write')
      .where('slot.id = :id', { id: slotId })
      .getOne();
    if (!slot) throw new NotFoundException('Booking slot not found');
    if (delta < 0 && slot.remaining < 1)
      throw new ConflictException('Booking slot is full');
    slot.remaining = Math.min(slot.capacity, slot.remaining + delta);
    if (slot.status !== 'Closed')
      slot.status = slot.remaining > 0 ? 'Available' : 'Full';
    await slots.save(slot);
  }
}

@Injectable()
export class PortalAdminDashboardService {
  constructor(
    @InjectRepository(PortalCoupon)
    private readonly coupons: Repository<PortalCoupon>,
    @InjectRepository(PortalEvent)
    private readonly events: Repository<PortalEvent>,
    @InjectRepository(PortalBundle)
    private readonly bundles: Repository<PortalBundle>,
    @InjectRepository(PortalCampaign)
    private readonly campaigns: Repository<PortalCampaign>,
    @InjectRepository(PortalFaq) private readonly faqs: Repository<PortalFaq>,
    @InjectRepository(PortalOrder)
    private readonly orders: Repository<PortalOrder>,
    @InjectRepository(PortalVoucher)
    private readonly vouchers: Repository<PortalVoucher>,
    @InjectRepository(PortalTicket)
    private readonly tickets: Repository<PortalTicket>,
    @InjectRepository(PortalFollow)
    private readonly follows: Repository<PortalFollow>,
    @InjectRepository(PortalCampaignProgress)
    private readonly progress: Repository<PortalCampaignProgress>,
    @InjectRepository(PortalEmailOtpChallenge)
    private readonly otpChallenges: Repository<PortalEmailOtpChallenge>,
    @InjectRepository(PortalReview)
    private readonly reviews: Repository<PortalReview>,
    @InjectRepository(PortalPromoCode)
    private readonly promoCodes: Repository<PortalPromoCode>,
    @InjectRepository(PortalBookingSlot)
    private readonly bookingSlots: Repository<PortalBookingSlot>,
    @InjectRepository(PortalBooking)
    private readonly bookings: Repository<PortalBooking>,
  ) {}

  async getOverview() {
    const [
      activeCoupons,
      activeEvents,
      activeBundles,
      activeCampaigns,
      activeFaqs,
      pendingOrders,
      vouchers,
      tickets,
      follows,
      campaignProgress,
      otpChallenges,
      reviews,
      promoCodes,
      bookingSlots,
      bookings,
    ] = await Promise.all([
      this.coupons.countBy({ active: true }),
      this.events.countBy({ active: true }),
      this.bundles.countBy({ active: true }),
      this.campaigns.countBy({ active: true }),
      this.faqs.countBy({ active: true }),
      this.orders.countBy({ status: 'Pending' }),
      this.vouchers.count(),
      this.tickets.count(),
      this.follows.count(),
      this.progress.count(),
      this.otpChallenges.count(),
      this.reviews.count(),
      this.promoCodes.countBy({ active: true }),
      this.bookingSlots.count(),
      this.bookings.count(),
    ]);

    return {
      activeCoupons,
      activeEvents,
      activeBundles,
      activeCampaigns,
      activeFaqs,
      pendingOrders,
      vouchers,
      tickets,
      follows,
      campaignProgress,
      otpChallenges,
      reviews,
      activePromoCodes: promoCodes,
      bookingSlots,
      bookings,
    };
  }
}
