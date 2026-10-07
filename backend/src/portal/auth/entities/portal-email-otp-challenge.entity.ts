import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('portal_email_otp_challenges')
@Index(['email', 'purpose', 'consumedAt'])
export class PortalEmailOtpChallenge {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index()
  @Column({ name: 'email', type: 'varchar', length: 320 })
  email: string;

  @Column({ name: 'purpose', type: 'varchar', length: 32 })
  purpose: string;

  @Column({ name: 'codeHash', type: 'varchar', length: 128 })
  codeHash: string;

  @Column({ name: 'expiresAt', type: 'timestamptz', precision: 3 })
  expiresAt: Date;

  @Column({ name: 'attempts', type: 'int', default: 0 })
  attempts: number;

  @Column({
    name: 'consumedAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  consumedAt: Date | null;

  @Column({ name: 'requestIp', type: 'varchar', length: 64, nullable: true })
  requestIp: string | null;

  @Column({
    name: 'lastSentAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  lastSentAt: Date | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
