import { IsNull } from 'typeorm';
import { PortalCampaignService } from '@/portal/campaigns/portal-campaign.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { resolveCity } from '@/portal/catalog/catalog-taxonomy';
import { PortalFollow } from '@/portal/customer/entities/portal-follow.entity';
import { PortalSavedOffer } from '@/portal/customer/entities/portal-saved-offer.entity';
import { PortalWallet } from '@/portal/commerce/entities/portal-wallet.entity';
import { PortalWalletTransaction } from '@/portal/commerce/entities/portal-wallet-transaction.entity';
import { CreatePortalFollowDto } from '@/portal/customer/dto/follow.dto';
import { UpdatePortalProfileDto } from '@/portal/customer/dto/profile.dto';
import {
  CreatePortalSavedOfferDto,
  SavedOfferQueryDto,
} from '@/portal/customer/dto/saved-offer.dto';
import { PortalAvatarImport } from '@/portal/customer/entities/portal-avatar-import.entity';
import { Not } from 'typeorm';
import { PortalAvatarService } from '@/portal/customer/portal-avatar.service';
import { UsersService } from '@/users/users.service';
import { NotificationsService } from '@/notifications/notifications.service';
import type { AuthenticatedUser } from '@/auth/interfaces/auth-request.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PortalCustomerService {
  constructor(
    @InjectRepository(PortalFollow)
    private readonly followRepository: Repository<PortalFollow>,
    @InjectRepository(PortalSavedOffer)
    private readonly savedOfferRepository: Repository<PortalSavedOffer>,
    @InjectRepository(PortalWallet)
    private readonly walletRepository: Repository<PortalWallet>,
    @InjectRepository(PortalWalletTransaction)
    private readonly walletTransactionRepository: Repository<PortalWalletTransaction>,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
    private readonly portalAvatarService: PortalAvatarService,
    private readonly campaigns: PortalCampaignService,
  ) {}
  async listSavedOffers(userId: number, query: SavedOfferQueryDto) {
    return this.savedOfferRepository.find({
      where: {
        userId,
        ...(query.targetType ? { targetType: query.targetType } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async saveOffer(userId: number, dto: CreatePortalSavedOfferDto) {
    // The unique key includes soft-deleted rows. Restore and save atomically so
    // retries and concurrent requests return the same saved offer.
    const result = await this.savedOfferRepository
      .createQueryBuilder()
      .insert()
      .into(PortalSavedOffer)
      .values({ userId, ...dto, deletedAt: null })
      .orUpdate(
        ['targetName', 'imageUrl', 'deletedAt', 'updatedAt'],
        ['userId', 'targetType', 'targetKey'],
      )
      .returning('*')
      .execute();
    return this.savedOfferRepository.create(
      (result.raw as PortalSavedOffer[])[0],
    );
  }

  async unsaveOffer(userId: number, id: number) {
    const saved = await this.savedOfferRepository.findOneBy({ id, userId });
    if (!saved) throw new NotFoundException('Saved offer not found');
    await this.savedOfferRepository.softRemove(saved);
  }

  async getRewards(userId: number) {
    await this.walletRepository
      .createQueryBuilder()
      .insert()
      .values({ userId, balance: 0, lifetimeEarned: 0 })
      .orIgnore()
      .execute();
    const wallet = await this.walletRepository.findOneByOrFail({ userId });
    const transactions = await this.walletTransactionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return {
      publicId: wallet.publicId,
      balance: wallet.balance,
      lifetimeEarned: wallet.lifetimeEarned,
      currency: 'IDR',
      nextReward: Math.max(0, 100000 - wallet.lifetimeEarned),
      transactions: transactions.map((transaction) => ({
        publicId: transaction.publicId,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        createdAt: transaction.createdAt,
      })),
    };
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findOne(userId);
    return this.serializeProfile(user);
  }

  async updateProfile(userId: number, dto: UpdatePortalProfileDto) {
    // A newly chosen city must be one of the curated active cities (stored with its
    // canonical name). Existing values are left alone until the user changes them.
    const changes: UpdatePortalProfileDto = { ...dto };
    if (typeof changes.preferredCity === 'string') {
      if (!changes.preferredCity.trim()) delete changes.preferredCity;
      else
        changes.preferredCity = await resolveCity(
          this.dataSource.manager,
          changes.preferredCity,
        ).catch(() => {
          throw new BadRequestException(
            'Kota belum tersedia. Pilih salah satu kota dari daftar.',
          );
        });
    }
    const user = await this.usersService.update(userId, changes);
    return this.serializeProfile(user);
  }

  async uploadAvatar(userId: number, file: Express.Multer.File) {
    await this.portalAvatarService.upload(userId, file);
    return this.getProfile(userId);
  }

  async listFollowing(userId: number) {
    return this.followRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async addFollowing(userId: number, dto: CreatePortalFollowDto) {
    // The unique key includes soft-deleted rows, so following again after an
    // unfollow must restore that row (same pattern as saved offers), not insert.
    const result = await this.followRepository
      .createQueryBuilder()
      .insert()
      .into(PortalFollow)
      .values({ userId, ...dto, deletedAt: null })
      .orUpdate(
        ['targetName', 'imageUrl', 'deletedAt', 'updatedAt'],
        ['userId', 'targetType', 'targetKey'],
      )
      .returning('*')
      .execute();
    return this.followRepository.create((result.raw as PortalFollow[])[0]);
  }

  async removeFollowing(userId: number, id: number) {
    const follow = await this.followRepository.findOneBy({ id, userId });
    if (!follow) throw new NotFoundException('Following item not found');
    await this.followRepository.softRemove(follow);
  }

  async listNotifications(user: AuthenticatedUser, page = 1, limit = 20) {
    const [result, unread] = await Promise.all([
      this.notificationsService.findAllForUser(
        user.userId,
        user.roles,
        page,
        limit,
      ),
      this.notificationsService.getUnreadCount(user.userId, user.roles),
    ]);
    return {
      data: result.data,
      meta: {
        ...result.meta,
        lastPage: Math.max(1, result.meta.lastPage),
        unread,
      },
    };
  }

  async markNotificationRead(user: AuthenticatedUser, id: number) {
    return this.notificationsService.markAsReadForUser(
      id,
      user.userId,
      user.roles,
    );
  }

  async markAllNotificationsRead(user: AuthenticatedUser) {
    await this.notificationsService.markAllAsRead(user.userId, user.roles);
    return { message: 'All notifications marked as read' };
  }

  async getProgress(userId: number, slug: string) {
    return this.campaigns.progress(userId, slug);
  }

  private async serializeProfile(user: {
    avatar?: { url: string } | null;
    id: number;
    email: string;
    fullname: string | null;
    phone: string | null;
    preferredCity: string | null;
    notificationsEnabled: boolean;
  }) {
    return {
      id: user.id,
      avatarUrl: user.avatar?.url ?? null,
      avatarImportPending:
        !user.avatar &&
        (await this.dataSource.getRepository(PortalAvatarImport).exists({
          where: { userId: user.id, pictureUrl: Not(IsNull()) },
        })),
      name: user.fullname ?? user.email.split('@')[0],
      email: user.email,
      phone: user.phone ?? '',
      preferredCity: user.preferredCity ?? 'Jakarta',
      notificationsEnabled: user.notificationsEnabled,
    };
  }
}
