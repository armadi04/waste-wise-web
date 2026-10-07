import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

/**
 * One security-relevant thing that happened, written once and never changed.
 *
 * Deliberately not a `BaseService` entity: an audit trail you can edit or
 * soft-delete isn't a trail. There is no update or delete path anywhere in the
 * module.
 */
@Entity('audit_logs')
export class AuditLog {
  @Index({ unique: true })
  @Column({ name: 'eventId', type: 'varchar', nullable: true })
  eventId: string | null;

  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  /** Dot-namespaced, e.g. `auth.login`, `user.impersonated`, `role.permissions_synced`. */
  @ApiProperty()
  @Index()
  @Column({ name: 'action' })
  action: string;

  /** Null for anonymous or system-driven events (a failed sign-in, a cron). */
  @ApiProperty({ nullable: true })
  @Index()
  @Column({ name: 'actorId', type: 'int', nullable: true })
  actorId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actorId' })
  actor: User | null;

  /**
   * Kept alongside `actorId` on purpose: the account may later be renamed or
   * deleted, and the trail should still say who did it at the time.
   */
  @ApiProperty({ nullable: true })
  @Column({ name: 'actorEmail', type: 'varchar', nullable: true })
  actorEmail: string | null;

  /** What the action was done to, e.g. `user`, `role`, `session`. */
  @ApiProperty({ nullable: true })
  @Column({ name: 'subjectType', type: 'varchar', nullable: true })
  subjectType: string | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'subjectId', type: 'varchar', nullable: true })
  subjectId: string | null;

  /** Human-readable one-liner, rendered where the log is read. */
  @ApiProperty({ nullable: true })
  @Column({ name: 'summary', type: 'varchar', nullable: true })
  summary: string | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'ipAddress', type: 'varchar', nullable: true })
  ipAddress: string | null;

  @ApiProperty()
  @Index()
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
