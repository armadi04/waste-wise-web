import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import type { SessionAudience } from '../session-policy';

/**
 * A signed-in device/browser session. The `sessionId` is minted at login and
 * carried in every JWT (access + refresh) as the `sessionId` claim, so a row
 * here is the authority on whether those tokens still work: the JWT strategy
 * rejects a token whose session is revoked or expired. That's what makes
 * "sign out this device" possible without waiting for the token TTL.
 */
@Entity('user_sessions')
export class UserSession {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @ApiProperty()
  @Index()
  @Column({ name: 'sessionId', unique: true })
  sessionId: string;

  @ApiProperty()
  @Index()
  @Column({ name: 'userId' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({ nullable: true })
  @Column({ name: 'ipAddress', type: 'varchar', nullable: true })
  ipAddress: string | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'userAgent', type: 'text', nullable: true })
  userAgent: string | null;

  /**
   * Set when an administrator opened this session by signing in as the user, so
   * it is not mistaken for the user's own device — and stays on the record.
   */
  @ApiProperty({ nullable: true })
  @Column({ name: 'impersonatedById', type: 'int', nullable: true })
  impersonatedById: number | null;

  /** Starter dashboard session policy. */
  @ApiProperty({ enum: ['admin'] })
  @Column({ name: 'audience', type: 'varchar', length: 16, default: 'admin' })
  audience: SessionAudience;

  @ApiProperty()
  @Column({ name: 'lastActiveAt', type: 'timestamptz', precision: 3 })
  lastActiveAt: Date;

  /** Idle deadline: slides on refresh, never past `absoluteExpiresAt`. */
  @ApiProperty()
  @Column({ name: 'expiresAt', type: 'timestamptz', precision: 3 })
  expiresAt: Date;

  /** Hard limit since login; the user must sign in again after it. */
  @ApiProperty()
  @Column({ name: 'absoluteExpiresAt', type: 'timestamptz', precision: 3 })
  absoluteExpiresAt: Date;

  @ApiProperty({ nullable: true })
  @Column({
    name: 'revokedAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  revokedAt: Date | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date;
}
