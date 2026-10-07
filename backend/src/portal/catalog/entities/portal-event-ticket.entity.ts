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

@Entity('portal_event_tickets')
@Index(['eventId', 'name'], { unique: true })
export class PortalEventTicket {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'publicId', type: 'uuid' })
  @Generated('uuid')
  publicId: string;

  @Index()
  @Column({ name: 'eventId', type: 'int' })
  eventId: number;

  @Column({ name: 'name', type: 'varchar', length: 80 })
  name: string;

  @Column({ name: 'description', type: 'varchar', length: 160 })
  description: string;

  @Column({ name: 'price', type: 'int' })
  price: number;

  @Column({ name: 'stockTotal', type: 'int' })
  stockTotal: number;

  @Column({ name: 'stockRemaining', type: 'int' })
  stockRemaining: number;

  @Column({ name: 'statusLabel', type: 'varchar', length: 80 })
  statusLabel: string;

  @Column({
    name: 'salesEndsAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  salesEndsAt: Date | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
