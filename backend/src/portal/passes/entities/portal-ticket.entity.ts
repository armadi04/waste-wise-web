import { ManyToOne, JoinColumn } from 'typeorm';
import { PortalOrderItem } from '@/portal/commerce/entities/portal-order-item.entity';
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

@Index(['orderItemId'], { unique: true, where: '"orderItemId" IS NOT NULL' })
@Entity('portal_tickets')
@Index(['userId', 'eventId'])
export class PortalTicket {
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
  @Column({ name: 'eventId', type: 'int' })
  eventId: number;

  @Column({ name: 'ticketTypeId', type: 'int' })
  ticketTypeId: number;

  @Index({ unique: true })
  @Column({ name: 'code', type: 'varchar', length: 80 })
  code: string;

  @Column({ name: 'attendee', type: 'varchar', length: 180 })
  attendee: string;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'Issued' })
  status: string;

  @Column({ name: 'imageUrl', type: 'varchar', length: 255 })
  imageUrl: string;

  @Column({
    name: 'checkedInAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  checkedInAt: Date | null;

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
