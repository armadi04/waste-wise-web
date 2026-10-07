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

@Entity('portal_saved_offers')
@Index(['userId', 'targetType', 'targetKey'], { unique: true })
export class PortalSavedOffer {
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

  @Column({ name: 'targetName', type: 'varchar', length: 180 })
  targetName: string;

  @Column({ name: 'imageUrl', type: 'varchar', length: 255 })
  imageUrl: string;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
