import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('portal_wallet_transactions')
@Index(['userId', 'createdAt'])
export class PortalWalletTransaction {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'publicId', type: 'uuid' })
  @Generated('uuid')
  publicId: string;

  @Index()
  @Column({ name: 'userId', type: 'int' })
  userId: number;

  @Column({ name: 'type', type: 'varchar', length: 32 })
  type: string;

  @Column({ name: 'amount', type: 'int' })
  amount: number;

  /** Caller-supplied key that makes manual adjustments idempotent. */
  @Index('IDX_portal_wallet_transactions_operation_key', { unique: true })
  @Column({
    name: 'operationKey',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  operationKey: string | null;

  @Column({ name: 'description', type: 'varchar', length: 180 })
  description: string;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;
}
