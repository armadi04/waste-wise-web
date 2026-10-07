import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('email_verification_tokens')
export class EmailVerificationToken {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index()
  @Column({ name: 'token', unique: true })
  token: string;

  @Column({ name: 'userId' })
  userId: number;

  @Column({ name: 'expiresAt', type: 'timestamptz', precision: 3 })
  expiresAt: Date;

  @Column({ name: 'usedAt', nullable: true, type: 'timestamptz', precision: 3 })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
