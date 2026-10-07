import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import type { User } from '../../users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('media')
@Index('IDX_media_avatarCleanup', [
  'managedAvatar',
  'cleanupAt',
  'cleanupLeaseUntil',
])
export class Media {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Exclude()
  @Column({ name: 'managedAvatar', default: false })
  managedAvatar: boolean;

  @Exclude()
  @Column({
    name: 'cleanupAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  cleanupAt: Date | null;

  @Exclude()
  @Column({
    name: 'cleanupLeaseUntil',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  cleanupLeaseUntil: Date | null;

  @ApiProperty()
  @Column({ name: 'filename' })
  filename: string;

  @ApiProperty()
  @Column({ name: 'originalName', type: 'varchar', nullable: true })
  originalName: string;

  @ApiProperty()
  @Column({ name: 'mimetype' })
  mimetype: string;

  @ApiProperty()
  @Column({ name: 'size', type: 'bigint', nullable: true })
  size: number;

  @ApiProperty({ nullable: true })
  @Column({ name: 'path', type: 'varchar', nullable: true })
  path: string;

  @ApiProperty({ nullable: true })
  @Column({ name: 'depotFileId', type: 'int', nullable: true })
  depotFileId: number;

  @ApiProperty({ nullable: true })
  @Column({ name: 'url', type: 'varchar', nullable: true })
  url: string;

  @ApiProperty({ nullable: true })
  @Column({ name: 'driveId', type: 'varchar', nullable: true })
  driveId: string;

  @ApiProperty({ nullable: true })
  @Column({ name: 'webviewLink', type: 'varchar', nullable: true })
  webviewLink: string;

  @ApiProperty({ nullable: true })
  @Column({ name: 'userId', type: 'int', nullable: true })
  userId: number;

  @ApiProperty()
  @Column({ name: 'isPrivate', default: false })
  isPrivate: boolean;

  @ManyToOne('User', 'media')
  @JoinColumn({ name: 'userId' })
  user: User;

  @ApiProperty()
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  @Exclude()
  deletedAt: Date;
}
