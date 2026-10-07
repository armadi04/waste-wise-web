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

/**
 * Curated coupon category. `name` is the exact label coupons carry in their
 * `category` text (kept in sync on rename) and the catalog filter accepts.
 * Featured categories become the portal home "moment lanes".
 */
@Entity('portal_coupon_categories')
export class PortalCouponCategory {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'publicId', type: 'uuid' })
  @Generated('uuid')
  publicId: string;

  @Index('IDX_portal_coupon_categories_slug', { unique: true })
  @Column({ name: 'slug', type: 'varchar', length: 80 })
  slug: string;

  @Index('IDX_portal_coupon_categories_name', { unique: true })
  @Column({ name: 'name', type: 'varchar', length: 80 })
  name: string;

  /** Short lane label shown on the portal home (e.g. "Makan"); falls back to name. */
  @Column({ name: 'label', type: 'varchar', length: 40, nullable: true })
  label: string | null;

  @Column({ name: 'blurb', type: 'varchar', length: 240, default: '' })
  blurb: string;

  @Column({ name: 'icon', type: 'varchar', length: 40, nullable: true })
  icon: string | null;

  @Column({ name: 'position', type: 'int', default: 0 })
  position: number;

  @Column({ name: 'featured', type: 'boolean', default: false })
  featured: boolean;

  @Column({ name: 'active', type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
