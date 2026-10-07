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

@Entity('portal_campaign_progress')
@Index(['userId', 'campaignId'], { unique: true })
export class PortalCampaignProgress {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'publicId', type: 'uuid' })
  @Generated('uuid')
  publicId: string;

  @Index()
  @Column({ name: 'userId', type: 'int' })
  userId: number;

  @Index()
  @Column({ name: 'campaignId', type: 'int' })
  campaignId: number;

  @Column({ name: 'points', type: 'int', default: 0 })
  points: number;

  @Column({ name: 'targetPoints', type: 'int' })
  targetPoints: number;

  @Column({ name: 'status', type: 'varchar', length: 40, default: 'pending' })
  status: string;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
