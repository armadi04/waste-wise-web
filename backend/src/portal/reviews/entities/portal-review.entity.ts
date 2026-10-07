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

@Entity('portal_reviews')
@Index(['targetType', 'targetKey'])
@Index('UQ_portal_reviews_user_target', ['userId', 'targetType', 'targetKey'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class PortalReview {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'publicId', type: 'uuid' })
  @Generated('uuid')
  publicId: string;

  @Index()
  @Column({ name: 'userId', type: 'int' })
  userId: number;

  @Column({ name: 'targetType', type: 'varchar', length: 32 })
  targetType: string;

  @Column({ name: 'targetKey', type: 'varchar', length: 180 })
  targetKey: string;

  @Column({ name: 'authorName', type: 'varchar', length: 180 })
  authorName: string;

  @Column({ name: 'rating', type: 'smallint' })
  rating: number;

  @Column({ name: 'body', type: 'text' })
  body: string;

  @Column({ name: 'verified', type: 'boolean', default: false })
  verified: boolean;

  @Column({ name: 'merchantReply', type: 'text', nullable: true })
  merchantReply: string | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
