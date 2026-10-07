import { ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { PortalReview } from '@/portal/reviews/entities/portal-review.entity';
import {
  CreatePortalReviewDto,
  ReviewQueryDto,
} from '@/portal/reviews/dto/review.dto';
import { UsersService } from '@/users/users.service';
import { PASS_STATUS } from '@/portal/passes/pass-status';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PortalReviewsService {
  constructor(
    @InjectRepository(PortalVoucher)
    private readonly voucherRepository: Repository<PortalVoucher>,
    @InjectRepository(PortalTicket)
    private readonly ticketRepository: Repository<PortalTicket>,
    @InjectRepository(PortalReview)
    private readonly reviewRepository: Repository<PortalReview>,
    private readonly usersService: UsersService,
  ) {}
  async listReviews(query: ReviewQueryDto & { userId?: number }) {
    const where = {
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.targetKey ? { targetKey: query.targetKey } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };
    const reviews = await this.reviewRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
    return reviews.map((review) => this.serializeReview(review));
  }

  async createReview(userId: number, dto: CreatePortalReviewDto) {
    const eligible =
      dto.targetType === 'coupon'
        ? await this.voucherRepository
            .createQueryBuilder('voucher')
            .innerJoin(PortalCoupon, 'coupon', 'coupon.id = voucher.couponId')
            .where('voucher.userId = :userId', { userId })
            .andWhere('coupon.slug = :targetKey', { targetKey: dto.targetKey })
            .andWhere('voucher.status = :status', {
              status: PASS_STATUS.Redeemed,
            })
            .getExists()
        : await this.ticketRepository
            .createQueryBuilder('ticket')
            .innerJoin(PortalEvent, 'event', 'event.id = ticket.eventId')
            .where('ticket.userId = :userId', { userId })
            .andWhere('event.slug = :targetKey', { targetKey: dto.targetKey })
            .andWhere('ticket.status = :status', {
              status: PASS_STATUS.CheckedIn,
            })
            .getExists();

    if (!eligible)
      throw new ConflictException('Review is available after using the offer');

    const existing = await this.reviewRepository.findOneBy({
      userId,
      targetType: dto.targetType,
      targetKey: dto.targetKey,
    });
    if (existing) throw new ConflictException('Review already submitted');

    const user = await this.usersService.findOne(userId);
    // Two submits at once both pass the check above; the unique index decides.
    const review = await this.reviewRepository
      .save(
        this.reviewRepository.create({
          ...dto,
          userId,
          authorName: user.fullname ?? user.email.split('@')[0],
          verified: true,
          merchantReply: null,
        }),
      )
      .catch((error: { code?: string }) => {
        if (error.code === '23505')
          throw new ConflictException('Review already submitted');
        throw error;
      });
    return this.serializeReview(review);
  }

  emptyReviewSummary(): {
    rating: number | null;
    reviewCount: number;
    verifiedReviewCount: number;
  } {
    return { rating: null, reviewCount: 0, verifiedReviewCount: 0 };
  }

  async eventReviewSummaries(slugs: string[]) {
    const summaries = new Map<
      string,
      ReturnType<PortalReviewsService['emptyReviewSummary']>
    >();
    if (!slugs.length) return summaries;
    const rows = await this.reviewRepository
      .createQueryBuilder('review')
      .select('review.targetKey', 'targetKey')
      .addSelect('ROUND(AVG(review.rating), 1)', 'rating')
      .addSelect('COUNT(*)', 'reviewCount')
      .addSelect(
        'COUNT(*) FILTER (WHERE review.verified = true)',
        'verifiedReviewCount',
      )
      .where('review.targetType = :targetType', { targetType: 'event' })
      .andWhere('review.targetKey IN (:...slugs)', { slugs })
      .groupBy('review.targetKey')
      .getRawMany<{
        targetKey: string;
        rating: string | null;
        reviewCount: string;
        verifiedReviewCount: string;
      }>();
    for (const row of rows)
      summaries.set(row.targetKey, {
        rating: row.rating == null ? null : Number(row.rating),
        reviewCount: Number(row.reviewCount),
        verifiedReviewCount: Number(row.verifiedReviewCount),
      });
    return summaries;
  }

  async reviewSummary(targetType: string, targetKey: string) {
    // Coupon detail and filters must use the same decimal rounding as catalog cards.
    if (targetType === 'coupon') {
      const row = await this.reviewRepository
        .createQueryBuilder('review')
        .select('ROUND(AVG(review.rating), 1)', 'rating')
        .addSelect('COUNT(*)', 'reviewCount')
        .addSelect(
          'COUNT(*) FILTER (WHERE review.verified = true)',
          'verifiedReviewCount',
        )
        .where('review.targetType = :targetType', { targetType })
        .andWhere('review.targetKey = :targetKey', { targetKey })
        .getRawOne<{
          rating: string | null;
          reviewCount: string;
          verifiedReviewCount: string;
        }>();
      return {
        rating: row?.rating == null ? null : Number(row.rating),
        reviewCount: Number(row?.reviewCount ?? 0),
        verifiedReviewCount: Number(row?.verifiedReviewCount ?? 0),
      };
    }
    return (
      (await this.eventReviewSummaries([targetKey])).get(targetKey) ??
      this.emptyReviewSummary()
    );
  }

  private serializeReview(review: PortalReview) {
    return {
      publicId: review.publicId,
      targetType: review.targetType,
      targetKey: review.targetKey,
      authorName: review.authorName,
      rating: review.rating,
      body: review.body,
      verified: review.verified,
      merchantReply: review.merchantReply,
      createdAt: review.createdAt,
    };
  }
}
