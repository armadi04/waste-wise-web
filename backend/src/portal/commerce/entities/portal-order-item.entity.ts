import type { OrderItemProductType } from '@/portal/commerce/order-item';
import { type BenefitSnapshot } from '@/portal/commerce/commerce-purchase';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  type Relation,
} from 'typeorm';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';

@Entity('portal_order_items')
export class PortalOrderItem {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'publicId', type: 'uuid' })
  @Generated('uuid')
  publicId: string;

  @Index()
  @Column({ name: 'orderId', type: 'int' })
  orderId: number;

  @Column({ name: 'productType', type: 'varchar', length: 32 })
  productType: OrderItemProductType;

  @Column({ name: 'productId', type: 'int' })
  productId: number;

  @Column({ name: 'packageId', type: 'int', nullable: true })
  packageId: number | null;

  @ManyToOne(() => PortalCouponPackage, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'packageId',
    foreignKeyConstraintName: 'FK_order_item_coupon_package',
  })
  packageRelation: Relation<PortalCouponPackage> | null;

  @Column({ name: 'packageSnapshot', type: 'jsonb', nullable: true })
  packageSnapshot: {
    publicId: string;
    name: string;
    benefits: string;
    price: number;
  } | null;

  @Column({ name: 'title', type: 'varchar', length: 180 })
  title: string;

  @Column({ name: 'quantity', type: 'int' })
  quantity: number;

  @Column({ name: 'unitPrice', type: 'int' })
  unitPrice: number;

  @Column({ name: 'unitIndex', type: 'int', nullable: true })
  unitIndex: number | null;

  @Column({ name: 'benefitSnapshot', type: 'jsonb', nullable: true })
  benefitSnapshot: BenefitSnapshot | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
