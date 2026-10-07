import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type OutboundEmailStatus = 'pending' | 'sent' | 'failed';

/**
 * One queued email. Mail used to go out inline on the request, so a mail-provider
 * blip silently lost a verification or invitation link; a row here survives the
 * request, the retry, and a restart.
 */
@Entity('outbound_emails')
export class OutboundEmail {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'to' })
  to: string;

  @Column({ name: 'subject' })
  subject: string;

  @Column({ name: 'html', type: 'text' })
  html: string;

  @Column({ name: 'text', type: 'text' })
  text: string;

  @Index()
  @Column({ name: 'status', type: 'varchar', default: 'pending' })
  status: OutboundEmailStatus;

  @Column({ name: 'attempts', type: 'int', default: 0 })
  attempts: number;

  /** When the dispatcher may next try this row; backs off after each failure. */
  @Index()
  @Column({ name: 'nextAttemptAt', type: 'timestamptz', precision: 3 })
  nextAttemptAt: Date;

  @Column({ name: 'lastError', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'sentAt', type: 'timestamptz', nullable: true, precision: 3 })
  sentAt: Date | null;

  /** Body holds a secret (e.g. a one-time code): clear it once delivery is settled. */
  @Column({ name: 'redactAfterSend', type: 'boolean', default: false })
  redactAfterSend: boolean;

  /** Content stops being valid at this time; an expired row is dropped, not sent. */
  @Column({
    name: 'expiresAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
