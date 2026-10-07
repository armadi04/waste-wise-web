import { MoreThan, IsNull } from 'typeorm';
import { PortalCampaignService } from '@/portal/campaigns/portal-campaign.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import {
  assertPackageAvailable,
  lockCouponPackage,
  packageSnapshot,
  refreshCouponSummary,
} from '@/portal/catalog/coupon-packages';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { PortalGift } from '@/portal/gifts/entities/portal-gift.entity';
import { CreatePortalGiftDto } from '@/portal/gifts/dto/gift.dto';
import { UsersService } from '@/users/users.service';
import { MailService } from '@/mail/mail.service';
import { PASS_STATUS } from '@/portal/passes/pass-status';
import { portalGiftUrl } from '@/portal/gifts/portal-links';
import { Injectable } from '@nestjs/common';
import { serializeVoucher } from '@/portal/passes/voucher.serializer';
const GIFTS_PER_SENDER_PER_DAY = 5;
@Injectable()
export class PortalGiftsService {
  constructor(
    @InjectRepository(PortalCoupon)
    private readonly couponRepository: Repository<PortalCoupon>,
    @InjectRepository(PortalGift)
    private readonly giftRepository: Repository<PortalGift>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly dataSource: DataSource,
    private readonly campaigns: PortalCampaignService,
  ) {}
  async listGifts(userId: number) {
    const gifts = await this.giftRepository.find({
      where: { senderUserId: userId },
      order: { createdAt: 'DESC' },
    });
    const coupons = await this.couponRepository.findBy({
      id: In(gifts.map((gift) => gift.couponId)),
    });
    const byId = new Map(coupons.map((coupon) => [coupon.id, coupon]));
    return gifts.map((gift) =>
      this.serializeGift(gift, byId.get(gift.couponId)),
    );
  }

  async createGift(userId: number, dto: CreatePortalGiftDto) {
    // A gift to yourself would be a second free voucher past the one-claim rule.
    const sender = await this.usersService.findOne(userId);
    if (
      sender.email.trim().toLowerCase() ===
      dto.recipientEmail.trim().toLowerCase()
    )
      throw new ConflictException('Gifts cannot be sent to your own email');
    const { coupon, gift } = await this.dataSource.transaction(
      async (manager) => {
        // Serialises this sender's gifts so the daily allowance can't be raced.
        await this.campaigns.lockCommerce(manager, userId);
        const sentToday = await manager.getRepository(PortalGift).countBy({
          senderUserId: userId,
          createdAt: MoreThan(new Date(Date.now() - 86_400_000)),
        });
        if (sentToday >= GIFTS_PER_SENDER_PER_DAY)
          throw new ConflictException(
            'Daily gift limit reached. Try again tomorrow.',
          );
        const coupon = await manager
          .getRepository(PortalCoupon)
          .createQueryBuilder('coupon')
          .setLock('pessimistic_write')
          .where('coupon.slug = :slug AND coupon.active = true', {
            slug: dto.slug,
          })
          .getOne();
        if (!coupon) throw new NotFoundException('Coupon not found');
        // Same sales window as a claim: a gift is issued like a free voucher.
        if (
          (coupon.salesEndsAt ?? coupon.expiresAt) <= new Date() ||
          (!coupon.validityDays && coupon.expiresAt <= new Date())
        )
          throw new ConflictException('Coupon has expired');
        const selected = await lockCouponPackage(
          manager,
          coupon.id,
          dto.packagePublicId,
        );
        // Gifts take stock without an order, so a paid package would be free.
        // Paid gifting waits for a checkout flow of its own.
        if (selected.price > 0)
          throw new ConflictException(
            'Gifts are available for free coupon packages only',
          );
        assertPackageAvailable(selected);
        selected.stockRemaining -= 1;
        await manager.getRepository(PortalCouponPackage).save(selected);
        await refreshCouponSummary(manager, coupon);
        const gift = await manager.getRepository(PortalGift).save(
          manager.getRepository(PortalGift).create({
            senderUserId: userId,
            couponId: coupon.id,
            packageId: selected.id,
            packageSnapshot: packageSnapshot(selected),
            code: `GFT-${randomUUID().slice(0, 8).toUpperCase()}`,
            recipientName: dto.recipientName,
            recipientEmail: dto.recipientEmail,
            message: dto.message ?? '',
            status: 'Ready',
            recipientUserId: null,
            expiresAt: coupon.expiresAt,
            timeZone: coupon.timeZone,
            redeemedAt: null,
            imageUrl: coupon.imageUrl,
          }),
        );
        return { coupon, gift };
      },
    );
    await this.mailService.sendPortalGift(
      gift.recipientEmail,
      gift.recipientName,
      `${coupon.title}${gift.packageSnapshot ? ` — ${gift.packageSnapshot.name}` : ''}`,
      gift.code,
      gift.message,
      portalGiftUrl(gift.code),
    );
    return this.serializeGift(gift, coupon);
  }

  async getPublicGift(code: string) {
    const gift = await this.giftRepository.findOneBy({ code });
    if (!gift) throw new NotFoundException('Gift not found');
    const coupon = await this.couponRepository.findOneBy({ id: gift.couponId });
    return {
      code: gift.code,
      targetKey: coupon?.slug ?? '',
      targetName: coupon?.title ?? 'Voucher hadiah',
      recipientName: gift.recipientName,
      package: gift.packageSnapshot ?? undefined,
      message: gift.message,
      status: gift.status,
      expiresAt: gift.expiresAt,
      timeZone: gift.timeZone,
      imageUrl: gift.imageUrl,
    };
  }

  async redeemGift(userId: number, code: string) {
    const user = await this.usersService.findOne(userId);
    return this.dataSource.transaction(async (manager) => {
      // Serialises this user's redemptions so the one-voucher-per-package check
      // below can't be raced by redeeming two gifts at once.
      await this.campaigns.lockCommerce(manager, userId);
      const gifts = manager.getRepository(PortalGift);
      const gift = await gifts
        .createQueryBuilder('gift')
        .setLock('pessimistic_write')
        .where('gift.code = :code', { code })
        .getOne();
      if (!gift) throw new NotFoundException('Gift not found');
      if (gift.status !== 'Ready')
        throw new ConflictException('Gift is no longer available');
      if (gift.expiresAt <= new Date())
        throw new ConflictException('Gift has expired');
      if (user.email.toLowerCase() !== gift.recipientEmail.toLowerCase()) {
        throw new ConflictException(
          'Gift email does not match the signed-in account',
        );
      }
      if (gift.senderUserId === userId)
        throw new ConflictException('You cannot redeem a gift you sent');
      // Locked like a claim, so a claim and a redemption can't both slip past
      // the one-voucher-per-package rule.
      const coupon = await manager
        .getRepository(PortalCoupon)
        .createQueryBuilder('coupon')
        .setLock('pessimistic_write')
        .where('coupon.id = :id AND coupon.active = true', {
          id: gift.couponId,
        })
        .getOne();
      if (!coupon) throw new NotFoundException('Coupon not found');
      // Gifts are free packages, which allow one voucher per user — the same
      // rule claimCoupon applies.
      const alreadyHeld = await manager.getRepository(PortalVoucher).existsBy({
        userId,
        couponId: coupon.id,
        packageId: gift.packageId ?? IsNull(),
      });
      if (alreadyHeld)
        throw new ConflictException(
          'You already have a voucher for this coupon package',
        );
      const voucher = await manager.getRepository(PortalVoucher).save(
        manager.getRepository(PortalVoucher).create({
          userId,
          couponId: coupon.id,
          code: gift.code,
          packageId: gift.packageId,
          packageSnapshot: gift.packageSnapshot,
          status: PASS_STATUS.Issued,
          expiresAt: gift.expiresAt,
          timeZone: gift.timeZone,
          redeemedAt: null,
          imageUrl: gift.imageUrl,
        }),
      );
      gift.status = 'Redeemed';
      gift.recipientUserId = userId;
      gift.redeemedAt = new Date();
      await gifts.save(gift);
      return serializeVoucher(voucher, coupon);
    });
  }

  private serializeGift(gift: PortalGift, coupon?: PortalCoupon) {
    return {
      id: gift.id,
      publicId: gift.publicId,
      code: gift.code,
      targetKey: coupon?.slug ?? '',
      targetName: coupon?.title ?? 'Voucher hadiah',
      recipientName: gift.recipientName,
      recipientEmail: gift.recipientEmail,
      message: gift.message,
      status: gift.status,
      expiresAt: gift.expiresAt,
      timeZone: gift.timeZone,
      imageUrl: gift.imageUrl,
      package: gift.packageSnapshot ?? undefined,
      redeemUrl: portalGiftUrl(gift.code),
      createdAt: gift.createdAt,
    };
  }
}
