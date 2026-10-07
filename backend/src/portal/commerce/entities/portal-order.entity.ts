import { type PurchaseSnapshot } from '@/portal/commerce/commerce-purchase';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Generated,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('portal_orders')
@Index('IDX_portal_orders_user_history', ['userId', 'createdAt', 'id'], {
  where: '"deletedAt" IS NULL',
})
@Index(['userId', 'idempotencyKey'], { unique: true })
@Index(
  'IDX_portal_orders_user_purchase_limit',
  ['userId', 'status', 'paymentExpiresAt'],
  {
    where: "status IN ('Paid', 'Pending')",
  },
)
export class PortalOrder {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index({ unique: true })
  @Column({ name: 'publicId', type: 'uuid' })
  @Generated('uuid')
  publicId: string;

  @Index()
  @Column({ name: 'userId', type: 'int' })
  userId: number;

  @Index({ unique: true })
  @Column({ name: 'orderNumber', type: 'varchar', length: 80 })
  orderNumber: string;

  @Column({ name: 'idempotencyKey', type: 'varchar', length: 80 })
  idempotencyKey: string;

  @Column({ name: 'status', type: 'varchar', length: 32, default: 'Pending' })
  status: string;

  @Column({ name: 'kind', type: 'varchar', length: 32 })
  kind: string;

  @Column({ name: 'total', type: 'int' })
  total: number;

  @Column({ name: 'subtotal', type: 'int', default: 0 })
  subtotal: number;

  @Column({ name: 'discount', type: 'int', default: 0 })
  discount: number;

  @Column({ name: 'promoCode', type: 'varchar', length: 40, nullable: true })
  promoCode: string | null;

  @Column({
    name: 'paymentMethod',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  paymentMethod: string | null;

  @Column({ name: 'paidAt', type: 'timestamptz', nullable: true, precision: 3 })
  paidAt: Date | null;

  @Column({ name: 'cashbackAmount', type: 'int', default: 0 })
  cashbackAmount: number;

  @Column({
    name: 'paymentReference',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  paymentReference: string | null;

  @Index('IDX_portal_orders_payment_deadline', {
    where: "status IN ('Paid', 'Pending')",
  })
  @Column({
    name: 'paymentExpiresAt',
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  paymentExpiresAt: Date | null;

  @Column({ name: 'virtualAccount', type: 'jsonb', nullable: true })
  virtualAccount: { bank: string; number: string; sandbox: boolean } | null;

  @Column({ name: 'refundStatus', type: 'varchar', length: 32, nullable: true })
  refundStatus: string | null;

  @Column({
    name: 'refundReason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  refundReason: string | null;

  @Column({
    name: 'refundRequestedAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  refundRequestedAt: Date | null;

  @Column({
    name: 'refundedAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  refundedAt: Date | null;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'IDR' })
  currency: string;

  @Column({ name: 'title', type: 'varchar', length: 180 })
  title: string;

  @Column({ name: 'meta', type: 'text' })
  meta: string;

  @Column({ name: 'quantity', type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'requestFingerprint', type: 'varchar', nullable: true })
  requestFingerprint: string | null;

  @Column({ name: 'purchaseSnapshot', type: 'jsonb', nullable: true })
  purchaseSnapshot: PurchaseSnapshot | null;

  @Column({ name: 'paymentState', type: 'varchar', nullable: true })
  paymentState: string | null;

  @Column({
    name: 'reservationReleasedAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  reservationReleasedAt: Date | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
