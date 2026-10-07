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
 * Curated city list for portal location pickers. Coupons and events keep the
 * city name as text, validated against active cities and renamed with them.
 */
@Entity('portal_cities')
export class PortalCity {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'publicId', type: 'uuid' })
  @Generated('uuid')
  publicId: string;

  @Index('IDX_portal_cities_slug', { unique: true })
  @Column({ name: 'slug', type: 'varchar', length: 100 })
  slug: string;

  @Index('IDX_portal_cities_name', { unique: true })
  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;

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
