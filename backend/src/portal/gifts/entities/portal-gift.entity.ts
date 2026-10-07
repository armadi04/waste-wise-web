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
  'CHK_portal_gifts_timeZone',
  `"timeZone" IN ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')`,
)
@Entity('portal_gifts')
@Index(['senderUserId', 'createdAt'])
@Index(['senderUserId', 'couponId'])
export class PortalGift {
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

  @Index()
  @Column({ name: 'senderUserId', type: 'int' })
  senderUserId: number;

  @Index()
  @Column({ name: 'couponId', type: 'int' })
  couponId: number;

  @Index({ unique: true })
  @Column({ name: 'code', type: 'varchar', length: 80 })
  code: string;

  @Column({ name: 'recipientName', type: 'varchar', length: 180 })
  recipientName: string;

  @Column({ name: 'recipientEmail', type: 'varchar', length: 255 })
  recipientEmail: string;

  @Column({ name: 'message', type: 'text', default: '' })
  message: string;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'Ready' })
  status: string;

  @Column({ name: 'recipientUserId', type: 'int', nullable: true })
  recipientUserId: number | null;

  @Column({ name: 'expiresAt', type: 'timestamptz', precision: 3 })
  expiresAt: Date;

  @Column({
    name: 'redeemedAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  redeemedAt: Date | null;

  @Column({ name: 'imageUrl', type: 'varchar', length: 255 })
  imageUrl: string;

  @Index('IDX_portal_gifts_package')
  @Column({ name: 'packageId', type: 'int', nullable: true })
  packageId: number | null;

  @Column({ name: 'packageSnapshot', type: 'jsonb', nullable: true })
  packageSnapshot: {
    publicId: string;
    name: string;
    benefits: string;
    price: number;
  } | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
