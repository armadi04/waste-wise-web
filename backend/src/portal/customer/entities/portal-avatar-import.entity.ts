import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { User } from '@/users/entities/user.entity';

@Entity('portal_avatar_imports')
@Index('IDX_portal_avatar_imports_due', ['availableAt', 'leaseUntil'], {
  where: '"pictureUrl" IS NOT NULL',
})
export class PortalAvatarImport {
  @PrimaryColumn({
    name: 'userId',
    type: 'int',
    primaryKeyConstraintName: 'PK_portal_avatar_imports',
  })
  userId: number;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'userId',
    foreignKeyConstraintName: 'FK_portal_avatar_imports_user',
  })
  user: User;

  @Column({ name: 'pictureUrl', type: 'varchar', length: 2048, nullable: true })
  pictureUrl: string | null;

  @Column({ name: 'attempts', type: 'int', default: 0 })
  attempts: number;

  @Column({
    name: 'availableAt',
    type: 'timestamptz',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP',
  })
  availableAt: Date;

  @Column({
    name: 'leaseUntil',
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  leaseUntil: Date | null;

  @Column({
    name: 'completedAt',
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  completedAt: Date | null;

  @Column({
    name: 'failedAt',
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  failedAt: Date | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;
}
