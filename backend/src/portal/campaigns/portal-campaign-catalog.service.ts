import { campaignRewardLabel } from '@/portal/campaigns/campaign-rules';
import { NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { CampaignQueryDto } from '@/portal/campaigns/dto/campaign-query.dto';
import { Injectable } from '@nestjs/common';
import { pageMeta } from '@/portal/shared/page-meta';

@Injectable()
export class PortalCampaignCatalogService {
  constructor(
    @InjectRepository(PortalCoupon)
    private readonly couponRepository: Repository<PortalCoupon>,
    @InjectRepository(PortalEvent)
    private readonly eventRepository: Repository<PortalEvent>,
    @InjectRepository(PortalCampaign)
    private readonly campaignRepository: Repository<PortalCampaign>,
  ) {}
  async listCampaigns(query: CampaignQueryDto) {
    const [data, total] = await this.campaignRepository.findAndCount({
      where: { active: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      data: await this.serializeCampaigns(data),
      meta: pageMeta(total, query.page, query.limit),
    };
  }

  async getCampaign(slug: string) {
    const campaign = await this.campaignRepository.findOneBy({
      slug,
      active: true,
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return (await this.serializeCampaigns([campaign]))[0];
  }

  private async serializeCampaigns(campaigns: PortalCampaign[]) {
    const couponIds = [
      ...new Set(
        campaigns.flatMap((campaign) => campaign.rules?.couponIds ?? []),
      ),
    ];
    const eventIds = [
      ...new Set(
        campaigns.flatMap((campaign) => campaign.rules?.eventIds ?? []),
      ),
    ];
    const [coupons, events] = await Promise.all([
      couponIds.length
        ? this.couponRepository.find({
            where: { id: In(couponIds), active: true },
          })
        : Promise.resolve([]),
      eventIds.length
        ? this.eventRepository.find({
            where: { id: In(eventIds), active: true },
          })
        : Promise.resolve([]),
    ]);
    return campaigns.map((campaign) => ({
      ...campaign,
      rewardLabel: campaign.rules
        ? campaignRewardLabel(campaign.rules)
        : campaign.rewardLabel,
      eligibleProducts: [
        ...coupons
          .filter((coupon) => campaign.rules?.couponIds.includes(coupon.id))
          .map((coupon) => ({
            kind: 'coupon' as const,
            slug: coupon.slug,
            title: coupon.title,
          })),
        ...events
          .filter((event) => campaign.rules?.eventIds.includes(event.id))
          .map((event) => ({
            kind: 'event' as const,
            slug: event.slug,
            title: event.title,
          })),
      ],
    }));
  }
}
