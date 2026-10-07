import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('portal_commerce_outbox')
export class PortalCommerceOutbox {
  @PrimaryGeneratedColumn({ name: 'id' }) id: number;
  @Index({ unique: true })
  @Column({ name: 'operationKey', type: 'varchar' })
  operationKey: string;
  @Column({ name: 'eventName', type: 'varchar' }) eventName: string;
  @Column({ name: 'payload', type: 'jsonb' }) payload: Record<string, unknown>;
  @Column({
    name: 'deliveredAt',
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  deliveredAt: Date | null;
  @Column({ name: 'attempts', type: 'int', default: 0 }) attempts: number;
  @Column({ name: 'lastError', type: 'text', nullable: true })
  lastError: string | null;
  // Set once delivery gives up (dead letter): the event stops blocking newer
  // ones and stays visible for an operator to inspect and replay.
  @Column({
    name: 'failedAt',
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  failedAt: Date | null;
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
