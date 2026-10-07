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

@Entity('portal_bookings')
@Index('UQ_portal_bookings_user_slot', ['userId', 'slotId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class PortalBooking {
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

  @Index()
  @Column({ name: 'slotId', type: 'int' })
  slotId: number;

  @Column({ name: 'attendee', type: 'varchar', length: 180 })
  attendee: string;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'Reserved' })
  status: string;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
