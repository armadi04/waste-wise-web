import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import type { User } from '../../users/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';
import type { MediaProvider } from '../storage/media-storage';

@Entity('media')
@Check('CHK_media_provider', '"provider" IN (\'s3\')')
@Check('CHK_media_state', "\"state\" IN ('pending', 'ready', 'deleting')")
@Check(
  'CHK_media_size',
  '"size" IS NULL OR ("size" >= 0 AND "size" <= 9007199254740991)',
)
@Check('CHK_media_ready_object', '"state" <> \'ready\' OR "path" IS NOT NULL')
@Index('IDX_media_cleanup', ['state', 'cleanupAt', 'cleanupLeaseUntil'])
export class Media {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @ApiProperty({ enum: ['s3'] })
  @Column({ name: 'provider', type: 'varchar', default: 's3' })
  provider: MediaProvider;

  @ApiProperty()
  @Column({ name: 'storageProfile', type: 'varchar', length: 64 })
  storageProfile: string;

  @Exclude()
  @Column({
    name: 'storageFingerprint',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  storageFingerprint: string | null;

  @Exclude()
  @Column({ name: 'state', type: 'varchar', default: 'ready' })
  state: 'pending' | 'ready' | 'deleting';

  @Exclude()
  @Column({ name: 'remoteName', type: 'varchar', nullable: true })
  remoteName: string | null;

  @Exclude()
  @Column({
    name: 'cleanupAt',
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  cleanupAt: Date | null;

  @Exclude()
  @Column({
    name: 'cleanupLeaseUntil',
    type: 'timestamptz',
    precision: 3,
    nullable: true,
  })
  cleanupLeaseUntil: Date | null;

  @Exclude()
  @Column({ name: 'cleanupLeaseToken', type: 'uuid', nullable: true })
  cleanupLeaseToken: string | null;

  @Exclude()
  @Column({ name: 'cleanupAttempts', type: 'int', default: 0 })
  cleanupAttempts: number;

  @Exclude()
  @Column({ name: 'cleanupErrorCode', type: 'varchar', nullable: true })
  cleanupErrorCode: string | null;

  @ApiProperty()
  @Column({ name: 'filename' })
  filename: string;

  @ApiProperty({ type: String, nullable: true })
  @Column({ name: 'originalName', type: 'varchar', nullable: true })
  originalName: string | null;

  @ApiProperty()
  @Column({ name: 'mimetype' })
  mimetype: string;

  @ApiProperty({ type: Number, nullable: true })
  @Column({
    name: 'size',
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | number | null) => {
        if (value === null) return null;
        const size = Number(value);
        if (!Number.isSafeInteger(size) || size < 0)
          throw new Error('Invalid media size');
        return size;
      },
    },
  })
  size: number | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'path', type: 'varchar', nullable: true })
  path: string | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'url', type: 'varchar', nullable: true })
  url: string | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'driveId', type: 'varchar', nullable: true })
  driveId: string | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'webviewLink', type: 'varchar', nullable: true })
  webviewLink: string | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'userId', type: 'int', nullable: true })
  userId: number | null;

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
