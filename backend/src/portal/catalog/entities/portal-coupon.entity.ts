import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { PortalCouponCategory } from '@/portal/catalog/entities/portal-coupon-category.entity';

import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';

@Check(
  'CHK_portal_coupons_timeZone',
  `"timeZone" IN ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')`,
)
@Entity('portal_coupons')
export class PortalCoupon {
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

  @Column({ name: 'merchant', type: 'varchar', length: 180 })
  merchant: string;

  @Index()
  @Column({ name: 'city', type: 'varchar', length: 100 })
  city: string;

  @Column({ name: 'location', type: 'varchar', length: 180 })
  location: string;

  /**
   * Read-only mirror of the category name for existing clients. A database trigger
   * sets it from `categoryId` on every write (see RequireCouponCategory migration);
   * never filter or write by it.
   */
  @Index()
  @Column({ name: 'category', type: 'varchar', length: 80 })
  category: string;

  /** Curated category; required, and the only key used for filtering. */
  @Index('IDX_portal_coupons_categoryId')
  @Column({ name: 'categoryId', type: 'int' })
  categoryId: number;

  @ManyToOne(() => PortalCouponCategory, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'categoryId',
    foreignKeyConstraintName: 'FK_portal_coupons_categoryId',
  })
  categoryIdRelation: Relation<PortalCouponCategory>;

  @Column({ name: 'price', type: 'int' })
  price: number;

  @Column({ name: 'oldPrice', type: 'int', nullable: true })
  oldPrice: number | null;

  @Column({ name: 'discount', type: 'varchar', length: 32, nullable: true })
  discount: string | null;

  @Index()
  @Column({ name: 'expiresAt', type: 'timestamptz', precision: 3 })
  expiresAt: Date;

  @Column({ name: 'stockTotal', type: 'int' })
  stockTotal: number;

  @Column({ name: 'stockRemaining', type: 'int' })
  stockRemaining: number;

  @Column({ name: 'imageUrl', type: 'varchar', length: 255 })
  imageUrl: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'benefits', type: 'text' })
  benefits: string;

  @Column({ name: 'terms', type: 'text' })
  terms: string;

  @Column({ name: 'redemption', type: 'text' })
  redemption: string;

  @Index()
  @Column({ name: 'active', type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'images', type: 'jsonb', default: () => "'[]'::jsonb" })
  images: Array<{ url: string; alt: string }>;

  @OneToMany(() => PortalCouponPackage, (item) => item.coupon, { eager: true })
  packages: PortalCouponPackage[];

  @Column({ name: 'maxPerOrder', type: 'int', nullable: true })
  maxPerOrder: number | null;

  @Column({ name: 'maxPerUser', type: 'int', nullable: true })
  maxPerUser: number | null;

  @Column({
    name: 'salesEndsAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  salesEndsAt: Date | null;

  @Column({ name: 'validityDays', type: 'int', nullable: true })
  validityDays: number | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
