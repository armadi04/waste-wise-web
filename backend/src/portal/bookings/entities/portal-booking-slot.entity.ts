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

@Entity('portal_booking_slots')
@Index('UQ_portal_booking_slots_event_start', ['eventId', 'startsAt'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class PortalBookingSlot {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'publicId', type: 'uuid' })
  @Generated('uuid')
  publicId: string;

  @Index()
  @Column({ name: 'eventId', type: 'int' })
  eventId: number;

  @Column({ name: 'startsAt', type: 'timestamptz', precision: 3 })
  startsAt: Date;

  @Column({ name: 'endsAt', type: 'timestamptz', precision: 3 })
  endsAt: Date;

  @Column({ name: 'capacity', type: 'int' })
  capacity: number;

  @Column({ name: 'remaining', type: 'int' })
  remaining: number;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'Available' })
  status: string;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
