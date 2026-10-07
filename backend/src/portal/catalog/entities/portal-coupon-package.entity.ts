import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Generated,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Check,
  type Relation,
} from 'typeorm';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';

@Entity('portal_coupon_packages')
@Index('IDX_coupon_package_order', ['couponId', 'position'])
@Index('IDX_coupon_package_default', ['couponId'], {
  unique: true,
  where: '"isDefault" = true',
})
@Check(
  'CHK_coupon_package_stock',
  '"stockTotal" >= 0 AND "stockRemaining" >= 0 AND "stockRemaining" <= "stockTotal"',
)
@Check(
  'CHK_coupon_package_price',
  '"price" >= 0 AND ("oldPrice" IS NULL OR "oldPrice" >= 0)',
)
export class PortalCouponPackage {
  @PrimaryGeneratedColumn({ name: 'id' }) id: number;
  @Index('IDX_coupon_package_public', { unique: true })
  @Column({ name: 'publicId', type: 'uuid' })
  @Generated('uuid')
  publicId: string;
  @Column({ name: 'couponId', type: 'int' }) couponId: number;
  @ManyToOne(() => PortalCoupon, (coupon) => coupon.packages)
  @JoinColumn({ name: 'couponId' })
  coupon: Relation<PortalCoupon>;
  @Column({ name: 'name', type: 'varchar', length: 180 }) name: string;
  @Column({ name: 'benefits', type: 'text' }) benefits: string;
  @Column({ name: 'price', type: 'int' }) price: number;
  @Column({ name: 'oldPrice', type: 'int', nullable: true }) oldPrice:
    number | null;
  @Column({ name: 'stockTotal', type: 'int' }) stockTotal: number;
  @Column({ name: 'stockRemaining', type: 'int' }) stockRemaining: number;
  @Column({ name: 'position', type: 'int', default: 0 }) position: number;
  @Column({ name: 'active', type: 'boolean', default: true }) active: boolean;
  @Column({ name: 'isDefault', type: 'boolean', default: false })
  isDefault: boolean;
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;
  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
