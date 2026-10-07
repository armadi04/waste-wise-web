import { ManyToOne, JoinColumn } from 'typeorm';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';
import { User } from '@/users/entities/user.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Append-only audit: entries, including reversals, are never soft-deleted.
@Entity('portal_campaign_ledger')
@Index(['campaignId', 'userId', 'sourceKey'], { unique: true })
@Index(['orderId'])
export class PortalCampaignLedger {
  @PrimaryGeneratedColumn({ name: 'id' }) id: number;
  @Column({ name: 'campaignId', type: 'int' }) campaignId: number;
  @Column({ name: 'userId', type: 'int' }) userId: number;
  @Column({ name: 'sourceKey', type: 'varchar', length: 120 })
  sourceKey: string;
  @Column({ name: 'kind', type: 'varchar', length: 30 }) kind: string;
  @Column({ name: 'points', type: 'int' }) points: number;
  @Column({ name: 'orderId', type: 'int', nullable: true }) orderId:
    number | null;
  @Column({ name: 'actorId', type: 'int', nullable: true }) actorId:
    number | null;
  @Column({ name: 'reason', type: 'varchar', length: 500 }) reason: string;
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;
  @ManyToOne(() => PortalCampaign, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'campaignId' })
  campaignIdRelation: PortalCampaign;

  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  userIdRelation: User;

  @ManyToOne(() => PortalOrder, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orderId' })
  orderIdRelation: PortalOrder | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actorId' })
  actorIdRelation: User | null;
}
