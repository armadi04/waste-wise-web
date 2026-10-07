import { ManyToOne, JoinColumn } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('portal_referrals')
export class PortalReferral {
  @PrimaryGeneratedColumn({ name: 'id' }) id: number;
  @Index({ unique: true })
  @Column({ name: 'userId', type: 'int' })
  userId: number;
  @Index({ unique: true })
  @Column({ name: 'code', type: 'varchar', length: 32 })
  code: string;
  @Column({ name: 'referrerUserId', type: 'int', nullable: true })
  referrerUserId: number | null;
  @Column({ name: 'firstOrderId', type: 'int', nullable: true }) firstOrderId:
    number | null;
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;
  @ManyToOne(() => User, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  userIdRelation: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'referrerUserId' })
  referrerUserIdRelation: User | null;

  @ManyToOne(() => PortalOrder, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'firstOrderId' })
  firstOrderIdRelation: PortalOrder | null;
}
