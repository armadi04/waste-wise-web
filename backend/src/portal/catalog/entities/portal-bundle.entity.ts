import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';
import {
  Column,
  ManyToOne,
  JoinColumn,
  type Relation,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('portal_bundles')
export class PortalBundle {
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

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'couponSlug', type: 'varchar', length: 160 })
  couponSlug: string;

  @Column({ name: 'eventSlug', type: 'varchar', length: 160 })
  eventSlug: string;

  @Column({ name: 'price', type: 'int' })
  price: number;

  @Column({ name: 'imageUrl', type: 'varchar', length: 255 })
  imageUrl: string;

  @Index()
  @Column({ name: 'active', type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'maxPerOrder', type: 'int', nullable: true })
  maxPerOrder: number | null;

  @Column({ name: 'maxPerUser', type: 'int', nullable: true })
  maxPerUser: number | null;

  @Column({ name: 'packageId', type: 'int', nullable: true })
  packageId: number | null;

  @ManyToOne(() => PortalCouponPackage, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'packageId',
    foreignKeyConstraintName: 'FK_bundle_packageId',
  })
  packageIdRelation: Relation<PortalCouponPackage> | null;

  @Column({ name: 'ticketTypeId', type: 'int', nullable: true })
  ticketTypeId: number | null;

  @Column({ name: 'componentsNeedReview', type: 'boolean', default: false })
  componentsNeedReview: boolean;

  @ManyToOne(() => PortalEventTicket, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'ticketTypeId',
    foreignKeyConstraintName: 'FK_bundle_ticketTypeId',
  })
  ticketTypeIdRelation: Relation<PortalEventTicket> | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
