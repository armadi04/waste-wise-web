import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

export type BlacklistReason = 'logout' | 'rotated';

@Entity('blacklisted_tokens')
export class BlacklistedToken {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'token', unique: true })
  token: string;

  /** 'logout' (revoked) or 'rotated' (replaced by a newer refresh token). */
  @Column({ name: 'reason', type: 'varchar', length: 16, default: 'logout' })
  reason: BlacklistReason;

  @CreateDateColumn({
    name: 'invalidatedAt',
    type: 'timestamptz',
    precision: 3,
  })
  invalidatedAt: Date;
}
