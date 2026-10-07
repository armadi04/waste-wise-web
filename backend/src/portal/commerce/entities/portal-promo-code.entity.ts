import { ManyToOne, JoinColumn } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('portal_promo_codes')
@Index(['ownerUserId', 'campaignId'], { unique: true })
export class PortalPromoCode {
  @Column({ name: 'ownerUserId', type: 'int', nullable: true }) ownerUserId:
    number | null;
  @Column({ name: 'campaignId', type: 'int', nullable: true }) campaignId:
    number | null;
  @Column({ name: 'reservedOrderId', type: 'int', nullable: true })
  reservedOrderId: number | null;
  @Column({
    name: 'consumedAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  consumedAt: Date | null;
  @Column({
    name: 'revokedAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  revokedAt: Date | null;

  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'publicId', type: 'uuid' })
  @Generated('uuid')
  publicId: string;

  @Index({ unique: true })
  @Column({ name: 'code', type: 'varchar', length: 40 })
  code: string;

  @Column({ name: 'kind', type: 'varchar', length: 20 })
  kind: string;

  @Column({ name: 'value', type: 'int' })
  value: number;

  @Column({ name: 'minimumOrder', type: 'int', default: 0 })
  minimumOrder: number;

  @Column({ name: 'maximumDiscount', type: 'int', nullable: true })
  maximumDiscount: number | null;

  @Column({ name: 'usageLimit', type: 'int', nullable: true })
  usageLimit: number | null;

  @Column({ name: 'usageCount', type: 'int', default: 0 })
  usageCount: number;

  @Column({ name: 'expiresAt', type: 'timestamptz', precision: 3 })
  expiresAt: Date;

  @Index()
  @Column({ name: 'active', type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'ownerUserId' })
  ownerUserIdRelation: User | null;

  @ManyToOne(() => PortalCampaign, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'campaignId' })
  campaignIdRelation: PortalCampaign | null;

  @ManyToOne(() => PortalOrder, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reservedOrderId' })
  reservedOrderIdRelation: PortalOrder | null;
}
