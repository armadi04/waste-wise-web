import { ManyToOne, JoinColumn } from 'typeorm';
import { PortalOrderItem } from '@/portal/commerce/entities/portal-order-item.entity';
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
  'CHK_portal_vouchers_timeZone',
  `"timeZone" IN ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')`,
)
@Index(['orderItemId'], { unique: true, where: '"orderItemId" IS NOT NULL' })
@Entity('portal_vouchers')
@Index(['userId', 'couponId'])
@Index('IDX_coupon_package_claim', ['userId', 'couponId', 'packageId'])
export class PortalVoucher {
  @Column({
    name: 'timeZone',
    type: 'varchar',
    length: 100,
    default: 'Asia/Jakarta',
  })
  timeZone: string;

  @Index({ unique: true })
  @Column({ name: 'orderItemId', type: 'int', nullable: true })
  orderItemId: number | null;

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
  @Column({ name: 'couponId', type: 'int' })
  couponId: number;

  @Index({ unique: true })
  @Column({ name: 'code', type: 'varchar', length: 80 })
  code: string;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'Issued' })
  status: string;

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

  @Index('IDX_portal_vouchers_package')
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
  @ManyToOne(() => PortalOrderItem, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'orderItemId' })
  orderItemIdRelation: PortalOrderItem | null;
}
