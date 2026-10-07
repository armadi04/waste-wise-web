import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * One single-use backup code for a user with two-factor enabled. Stored as a
 * bcrypt hash — a database leak must not hand out working codes — and marked
 * `usedAt` the moment it is spent, so losing the authenticator app is
 * recoverable but a captured code isn't reusable.
 */
@Entity('two_factor_recovery_codes')
export class TwoFactorRecoveryCode {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index()
  @Column({ name: 'userId' })
  userId: number;

  @Column({ name: 'codeHash' })
  codeHash: string;

  @Column({ name: 'usedAt', type: 'timestamptz', nullable: true, precision: 3 })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
