import { saleDeadline } from '@/portal/commerce/commerce-purchase';
import {
  eventAvailability,
  eventAvailabilityLabel,
} from '@/portal/catalog/event-availability';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PortalBundle } from '@/portal/catalog/entities/portal-bundle.entity';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';
import { PortalFaq } from '@/portal/catalog/entities/portal-faq.entity';
import { PortalCity } from '@/portal/catalog/entities/portal-city.entity';
import { PortalCouponCategory } from '@/portal/catalog/entities/portal-coupon-category.entity';
import { PortalContentEntry } from '@/portal/catalog/entities/portal-content-entry.entity';
import { PORTAL_CONTENT } from '@/portal/catalog/portal-content.registry';
import { PortalReview } from '@/portal/reviews/entities/portal-review.entity';
import { CatalogQueryDto } from '@/portal/catalog/dto/catalog-query.dto';
import { CouponCatalogQueryDto } from '@/portal/catalog/dto/coupon-catalog-query.dto';
import { CouponCategoryQueryDto } from '@/portal/catalog/dto/coupon-category.dto';
import { Injectable } from '@nestjs/common';
import { PortalReviewsService } from '@/portal/reviews/portal-reviews.service';
import { dateLabel } from '@/portal/shared/date-label';
import { pageMeta } from '@/portal/shared/page-meta';

@Injectable()
export class PortalCatalogService {
  constructor(
    @InjectRepository(PortalCoupon)
    private readonly couponRepository: Repository<PortalCoupon>,
    @InjectRepository(PortalEvent)
    private readonly eventRepository: Repository<PortalEvent>,
    @InjectRepository(PortalEventTicket)
    private readonly eventTicketRepository: Repository<PortalEventTicket>,
    @InjectRepository(PortalBundle)
    private readonly bundleRepository: Repository<PortalBundle>,
    @InjectRepository(PortalFaq)
    private readonly faqRepository: Repository<PortalFaq>,
    @InjectRepository(PortalReview)
    private readonly reviewRepository: Repository<PortalReview>,
    private readonly dataSource: DataSource,
    private readonly reviews: PortalReviewsService,
  ) {}
  async listCoupons(query: CouponCatalogQueryDto) {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new BadRequestException('minPrice must not exceed maxPrice');
    const builder = this.couponRepository
      .createQueryBuilder('coupon')
      .where('coupon.active = true')
      .leftJoinAndSelect('coupon.packages', 'packages');

    if (query.q) {
      builder.andWhere(
        '(coupon.title ILIKE :search OR coupon.merchant ILIKE :search OR coupon.location ILIKE :search)',
        { search: `%${query.q}%` },
      );
    }
    if (query.city)
      builder.andWhere('coupon.city = :city', { city: query.city });
    // Filter by the curated category only; the value may be its name or slug.
    if (query.category)
      builder.andWhere(
        `coupon."categoryId" IN ${builder
          .subQuery()
          .select('category.id')
          .from(PortalCouponCategory, 'category')
          .where(
            '(LOWER(category.name) IN (:...categoryNames) OR category.slug IN (:...category))',
          )
          .getQuery()}`,
        {
          category: query.category,
          categoryNames: query.category.map((value) => value.toLowerCase()),
        },
      );

    if (query.minPrice !== undefined)
      builder.andWhere('coupon.price >= CAST(:minPrice AS numeric)', {
        minPrice: query.minPrice,
      });
    if (query.maxPrice !== undefined)
      builder.andWhere('coupon.price <= CAST(:maxPrice AS numeric)', {
        maxPrice: query.maxPrice,
      });
    if (query.minDiscount !== undefined)
      builder.andWhere(
        `CASE WHEN coupon.oldPrice > coupon.price AND coupon.oldPrice > 0
        THEN ROUND((1 - coupon.price::numeric / coupon.oldPrice) * 100)
        ELSE 0 END >= :minDiscount`,
        { minDiscount: query.minDiscount },
      );
    if (query.minRating !== undefined) {
      const average = this.reviewRepository
        .createQueryBuilder('review')
        .select('ROUND(AVG(review.rating), 1)')
        .where('review.targetType = :reviewType', { reviewType: 'coupon' })
        .andWhere('review.targetKey = coupon.slug');
      builder.andWhere(`(${average.getQuery()}) >= :minRating`, {
        ...average.getParameters(),
        minRating: query.minRating,
      });
    }

    if (query.sort === 'price-asc') builder.orderBy('coupon.price', 'ASC');
    else if (query.sort === 'price-desc')
      builder.orderBy('coupon.price', 'DESC');
    else if (query.sort === 'ending-soon')
      builder.orderBy('coupon.expiresAt', 'ASC');
    else builder.orderBy('coupon.createdAt', 'DESC');
    builder.addOrderBy('coupon.id', 'DESC');

    const [items, total] = await builder
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    // Aggregate once for the page; package joins must not multiply review rows.
    const summaries = items.length
      ? await this.reviewRepository
          .createQueryBuilder('review')
          .select('review.targetKey', 'slug')
          .addSelect('ROUND(AVG(review.rating), 1)', 'rating')
          .addSelect('COUNT(*)', 'reviewCount')
          .addSelect(
            'COUNT(*) FILTER (WHERE review.verified = true)',
            'verifiedReviewCount',
          )
          .where('review.targetType = :type', { type: 'coupon' })
          .andWhere('review.targetKey IN (:...slugs)', {
            slugs: items.map((item) => item.slug),
          })
          .groupBy('review.targetKey')
          .getRawMany<{
            slug: string;
            rating: string;
            reviewCount: string;
            verifiedReviewCount: string;
          }>()
      : [];
    const reviews = new Map(
      summaries.map((row) => [
        row.slug,
        {
          rating: Number(row.rating),
          reviewCount: Number(row.reviewCount),
          verifiedReviewCount: Number(row.verifiedReviewCount),
        },
      ]),
    );
    return {
      data: await Promise.all(
        items.map((item) =>
          this.serializeCoupon(
            item,
            reviews.get(item.slug) ?? {
              rating: null,
              reviewCount: 0,
              verifiedReviewCount: 0,
            },
          ),
        ),
      ),
      meta: pageMeta(total, query.page, query.limit),
    };
  }

  async getCoupon(slug: string) {
    const item = await this.couponRepository.findOneBy({ slug, active: true });
    if (!item) throw new NotFoundException('Coupon not found');
    return this.serializeCoupon(item);
  }

  async listEvents(query: CatalogQueryDto) {
    const builder = this.eventRepository
      .createQueryBuilder('event')
      .where('event.active = true');

    if (query.q) {
      builder.andWhere(
        '(event.title ILIKE :search OR event.venue ILIKE :search OR event.city ILIKE :search)',
        { search: `%${query.q}%` },
      );
    }
    if (query.city)
      builder.andWhere('event.city = :city', { city: query.city });
    if (query.sort === 'price-asc') builder.orderBy('event.basePrice', 'ASC');
    else if (query.sort === 'price-desc')
      builder.orderBy('event.basePrice', 'DESC');
    else builder.orderBy('event.startsAt', 'ASC');

    const [items, total] = await builder
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    const tickets = items.length
      ? await this.eventTicketRepository.find({
          where: { eventId: In(items.map((item) => item.id)) },
          order: { price: 'ASC' },
        })
      : [];
    const reviews = await this.reviews.eventReviewSummaries(
      items.map((item) => item.slug),
    );
    const ticketsByEvent = new Map<number, PortalEventTicket[]>();
    for (const ticket of tickets) {
      const group = ticketsByEvent.get(ticket.eventId) ?? [];
      group.push(ticket);
      ticketsByEvent.set(ticket.eventId, group);
    }
    return {
      data: await Promise.all(
        items.map((item) =>
          this.serializeEvent(
            item,
            ticketsByEvent.get(item.id) ?? [],
            reviews.get(item.slug) ?? this.reviews.emptyReviewSummary(),
          ),
        ),
      ),
      meta: pageMeta(total, query.page, query.limit),
    };
  }

  async getEvent(slug: string) {
    const item = await this.eventRepository.findOneBy({ slug, active: true });
    if (!item) throw new NotFoundException('Event not found');
    return this.serializeEvent(item);
  }

  async listBundles() {
    const bundles = await this.bundleRepository.find({
      where: { active: true },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(bundles.map((bundle) => this.serializeBundle(bundle)));
  }

  async getBundle(slug: string) {
    const bundle = await this.bundleRepository.findOneBy({
      slug,
      active: true,
    });
    if (!bundle) throw new NotFoundException('Bundle not found');
    return this.serializeBundle(bundle);
  }

  async listFaq() {
    return this.faqRepository.find({
      where: { active: true },
      order: { position: 'ASC' },
    });
  }

  async listCouponCategories(query: CouponCategoryQueryDto) {
    const builder = this.couponRepository
      .createQueryBuilder('coupon')
      .innerJoin(
        PortalCouponCategory,
        'category',
        'category.id = coupon."categoryId" AND category."deletedAt" IS NULL',
      )
      .select('category.name', 'name')
      .addSelect('COUNT(*)', 'count')
      .addSelect('category.slug', 'slug')
      .addSelect('category.label', 'label')
      .addSelect('category.blurb', 'blurb')
      .addSelect('category.icon', 'icon')
      .addSelect('category.position', 'position')
      .addSelect('category.featured', 'featured')
      .where('coupon.active = true')
      .andWhere('category.active = true')
      .groupBy('category.id')
      .orderBy('category.position', 'ASC')
      .addOrderBy('category.name', 'ASC');
    if (query.city)
      builder.andWhere('coupon.city = :city', { city: query.city });
    const rows = await builder.getRawMany<{
      name: string;
      count: string;
      slug: string | null;
      label: string | null;
      blurb: string | null;
      icon: string | null;
      position: number | null;
      featured: boolean | null;
    }>();
    return rows.map((row) => ({
      name: row.name,
      count: Number(row.count),
      slug: row.slug ?? null,
      label: row.label ?? null,
      blurb: row.blurb || null,
      icon: row.icon ?? null,
      position: row.position ?? null,
      featured: Boolean(row.featured),
    }));
  }

  async getContent(key: string) {
    if (!PORTAL_CONTENT[key]) throw new NotFoundException('Content not found');
    const entry = await this.dataSource
      .getRepository(PortalContentEntry)
      .findOneBy({ key, published: true });
    if (!entry) throw new NotFoundException('Content not found');
    return {
      key: entry.key,
      title: entry.title,
      summary: entry.summary,
      sections: entry.sections,
      data: entry.data,
      updatedAt: entry.updatedAt,
    };
  }

  async listLocations() {
    const curated = await this.dataSource.getRepository(PortalCity).find({
      where: { active: true },
      order: { featured: 'DESC', position: 'ASC', name: 'ASC' },
    });
    if (curated.length)
      return curated.map((city) => ({
        name: city.name,
        slug: city.slug,
        featured: city.featured,
      }));
    const [couponCities, eventCities] = await Promise.all([
      this.couponRepository
        .createQueryBuilder('coupon')
        .select('DISTINCT coupon.city', 'city')
        .where('coupon.active = true')
        .getRawMany<{ city: string }>(),
      this.eventRepository
        .createQueryBuilder('event')
        .select('DISTINCT event.city', 'city')
        .where('event.active = true')
        .getRawMany<{ city: string }>(),
    ]);

    return [
      ...new Set(
        [...couponCities, ...eventCities]
          .map(({ city }) => city)
          .filter(Boolean),
      ),
    ]
      .sort()
      .map((city) => ({
        name: city,
        slug: city.toLowerCase().replaceAll(' ', '-'),
        featured: false,
      }));
  }

  private async serializeBundle(bundle: PortalBundle) {
    const manager = this.bundleRepository.manager;
    const coupon = await manager
      .getRepository(PortalCoupon)
      .findOneBy({ slug: bundle.couponSlug, active: true });
    const event = await manager
      .getRepository(PortalEvent)
      .findOneBy({ slug: bundle.eventSlug, active: true });
    const pack = bundle.packageId
      ? await manager
          .getRepository(PortalCouponPackage)
          .findOneBy({ id: bundle.packageId, active: true })
      : null;
    const ticket = bundle.ticketTypeId
      ? await manager
          .getRepository(PortalEventTicket)
          .findOneBy({ id: bundle.ticketTypeId })
      : null;
    const now = new Date();
    const configured = !!(
      coupon &&
      event &&
      !bundle.componentsNeedReview &&
      pack?.couponId === coupon.id &&
      ticket?.eventId === event.id
    );
    const endsAt = saleDeadline(
      coupon?.salesEndsAt ?? coupon?.expiresAt,
      coupon && !coupon.validityDays ? coupon.expiresAt : null,
      ticket?.salesEndsAt,
      event?.startsAt,
    );
    return {
      ...bundle,
      stockRemaining:
        configured && endsAt > now
          ? Math.min(pack.stockRemaining, ticket.stockRemaining)
          : 0,
      maxPerOrder: Math.min(
        10,
        bundle.maxPerOrder ?? 10,
        coupon?.maxPerOrder ?? 10,
        event?.maxPerOrder ?? 10,
      ),
      configured,
      salesEndsAt: Number.isFinite(endsAt.getTime()) ? endsAt : null,
    };
  }

  private async serializeEvent(
    event: PortalEvent,
    suppliedTickets?: PortalEventTicket[],
    suppliedReviews?: ReturnType<PortalReviewsService['emptyReviewSummary']>,
  ) {
    const tickets =
      suppliedTickets ??
      (await this.eventTicketRepository.find({
        where: { eventId: event.id },
        order: { price: 'ASC' },
      }));
    const availability = eventAvailability(
      tickets.map((ticket) => ticket.stockRemaining),
    );
    return {
      publicId: event.publicId,
      slug: event.slug,
      title: event.title,
      type: event.type,
      date: new Intl.DateTimeFormat('id-ID', {
        timeZone: event.timeZone,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(event.startsAt),
      month: new Intl.DateTimeFormat('id-ID', {
        timeZone: event.timeZone,
        month: 'short',
      }).format(event.startsAt),
      day: new Intl.DateTimeFormat('id-ID', {
        timeZone: event.timeZone,
        day: '2-digit',
      }).format(event.startsAt),
      venue: event.venue,
      timeZone: event.timeZone,
      startsAt: event.startsAt,
      maxPerOrder: event.maxPerOrder ?? null,
      maxPerUser: event.maxPerUser ?? null,
      time: new Intl.DateTimeFormat('id-ID', {
        timeZone: event.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(event.startsAt),
      price: event.basePrice,
      status: eventAvailabilityLabel(availability),
      availability,
      image: event.imageUrl,
      description: event.description,
      reviews:
        suppliedReviews ??
        (await this.reviews.reviewSummary('event', event.slug)),
      ticketOptions: tickets.map((ticket) => ({
        publicId: ticket.publicId,
        name: ticket.name,
        description: ticket.description,
        price: ticket.price,
        stock: ticket.stockRemaining,
        salesEndsAt: ticket.salesEndsAt ?? event.startsAt,
        status: eventAvailabilityLabel(
          eventAvailability([ticket.stockRemaining]),
        ),
        availability: eventAvailability([ticket.stockRemaining]),
      })),
    };
  }

  private async serializeCoupon(
    coupon: PortalCoupon,
    reviews?: {
      rating: number | null;
      reviewCount: number;
      verifiedReviewCount: number;
    },
  ) {
    return {
      publicId: coupon.publicId,
      slug: coupon.slug,
      title: coupon.title,
      merchant: coupon.merchant,
      location: coupon.location,
      city: coupon.city,
      category: coupon.category,
      price: coupon.price,
      oldPrice: coupon.oldPrice,
      discount: coupon.discount,
      expiry: coupon.validityDays
        ? `Berlaku ${coupon.validityDays} hari sejak diterbitkan`
        : `Berlaku sampai ${dateLabel(coupon.expiresAt, coupon.timeZone)}`,
      expiresAt: coupon.validityDays
        ? (coupon.salesEndsAt ?? coupon.expiresAt)
        : coupon.expiresAt,
      timeZone: coupon.timeZone,
      stock:
        coupon.stockRemaining > 0
          ? `Sisa ${coupon.stockRemaining} kupon`
          : 'Habis',
      stockRemaining: coupon.stockRemaining,
      maxPerOrder: coupon.maxPerOrder ?? null,
      maxPerUser: coupon.maxPerUser ?? null,
      salesEndsAt: coupon.salesEndsAt ?? coupon.expiresAt,
      validityDays: coupon.validityDays ?? null,
      image: coupon.imageUrl,
      description: coupon.description,
      benefits: coupon.benefits,
      terms: coupon.terms,
      redemption: coupon.redemption,
      images: coupon.images?.length
        ? coupon.images
        : [{ url: coupon.imageUrl, alt: coupon.title }],
      packages: (coupon.packages ?? [])
        .filter((item) => item.active)
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          publicId: item.publicId,
          name: item.name,
          benefits: item.benefits,
          price: item.price,
          oldPrice: item.oldPrice,
          stockRemaining: item.stockRemaining,
        })),
      kind: 'coupon',
      reviews:
        reviews ?? (await this.reviews.reviewSummary('coupon', coupon.slug)),
    };
  }
}
