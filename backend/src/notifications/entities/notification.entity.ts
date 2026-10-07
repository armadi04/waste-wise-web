import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

@Entity('notifications')
export class Notification {
  @Index({ unique: true })
  @Column({ name: 'eventId', type: 'varchar', nullable: true })
  eventId: string | null;

  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @ApiProperty({ nullable: true })
  @Column({ name: 'userId', type: 'int', nullable: true })
  @Index()
  userId: number;

  @ApiProperty({ type: () => User, nullable: true })
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty({ nullable: true })
  @Column({ name: 'targetRole', type: 'varchar', nullable: true })
  @Index()
  targetRole: string;

  @ApiProperty({ nullable: true })
  @Column({ name: 'actorId', type: 'int', nullable: true })
  @Index()
  actorId: number;

  @ApiProperty()
  @Column({ name: 'title' })
  title: string;

  @ApiProperty()
  @Column({ name: 'message', type: 'text' })
  message: string;

  @ApiProperty({ enum: NotificationType })
  @Column({
    name: 'type',
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.INFO,
  })
  type: NotificationType;

  @ApiProperty()
  @Column({ name: 'isRead', default: false })
  isRead: boolean;

  @ApiProperty({ nullable: true })
  @Column({ name: 'link', type: 'varchar', nullable: true })
  link: string;

  @ApiProperty()
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;
}
