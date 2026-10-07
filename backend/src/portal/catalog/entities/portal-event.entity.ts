import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Check(
  'CHK_portal_events_timeZone',
  `"timeZone" IN ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')`,
)
@Entity('portal_events')
export class PortalEvent {
  @Column({
    name: 'timeZone',
    type: 'varchar',
    length: 100,
    default: 'Asia/Jakarta',
  })
  timeZone: string;

  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'publicId', type: 'uuid' })
  @Generated('uuid')
  publicId: string;

  @Index({ unique: true })
  @Column({ name: 'slug', type: 'varchar', length: 160 })
  slug: string;

  @Column({ name: 'title', type: 'varchar', length: 180 })
  title: string;

  @Column({ name: 'type', type: 'varchar', length: 120 })
  type: string;

  @Column({ name: 'dateLabel', type: 'varchar', length: 40 })
  dateLabel: string;

  @Column({ name: 'monthLabel', type: 'varchar', length: 40 })
  monthLabel: string;

  @Column({ name: 'dayLabel', type: 'varchar', length: 40 })
  dayLabel: string;

  @Column({ name: 'startsAt', type: 'timestamptz', precision: 3 })
  startsAt: Date;

  @Column({ name: 'venue', type: 'varchar', length: 160 })
  venue: string;

  @Index()
  @Column({ name: 'city', type: 'varchar', length: 100 })
  city: string;

  @Column({ name: 'timeLabel', type: 'varchar', length: 40 })
  timeLabel: string;

  @Column({ name: 'basePrice', type: 'int' })
  basePrice: number;

  @Column({ name: 'statusLabel', type: 'varchar', length: 80 })
  statusLabel: string;

  @Column({ name: 'imageUrl', type: 'varchar', length: 255 })
  imageUrl: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Index()
  @Column({ name: 'active', type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'maxPerOrder', type: 'int', nullable: true })
  maxPerOrder: number | null;

  @Column({ name: 'maxPerUser', type: 'int', nullable: true })
  maxPerUser: number | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
