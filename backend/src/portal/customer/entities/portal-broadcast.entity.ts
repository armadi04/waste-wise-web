import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** In-app announcement fanned out to customers as individual notifications. */
@Entity('portal_broadcasts')
export class PortalBroadcast {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'publicId', type: 'uuid' })
  @Generated('uuid')
  publicId: string;

  /** Caller key so a retried send creates one broadcast. */
  @Index('IDX_portal_broadcasts_operationKey', { unique: true })
  @Column({ name: 'operationKey', type: 'varchar', length: 120 })
  operationKey: string;

  @Column({ name: 'title', type: 'varchar', length: 120 })
  title: string;

  @Column({ name: 'message', type: 'varchar', length: 500 })
  message: string;

  @Column({ name: 'link', type: 'varchar', length: 255, nullable: true })
  link: string | null;

  @Column({ name: 'type', type: 'varchar', length: 20, default: 'info' })
  type: string;

  /** `all` customers who allow notifications, or the explicit `userIds`. */
  @Column({ name: 'audience', type: 'varchar', length: 20 })
  audience: string;

  @Column({ name: 'userIds', type: 'jsonb', nullable: true })
  userIds: number[] | null;

  @Column({ name: 'recipientCount', type: 'int', default: 0 })
  recipientCount: number;

  @Column({ name: 'createdById', type: 'int' })
  createdById: number;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
