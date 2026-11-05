import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { Media } from '../../media/entities/media.entity';

export enum ReportStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
}

export enum WasteCategory {
  ORGANIC_WASTE = 'ORGANIC_WASTE',
  PLASTIC_WASTE = 'PLASTIC_WASTE',
  PAPER_WASTE = 'PAPER_WASTE',
}

export enum ClassificationStatus {
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

const numericTransformer = {
  to: (value: number | null) => value,
  from: (value: string | number | null) =>
    value === null || value === undefined ? null : Number(value),
};

@Entity('reports')
export class Report {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @ApiProperty()
  @Index('IDX_reports_reporterId')
  @Column({ name: 'reporterId', type: 'int' })
  reporterId: number;

  @ApiProperty({ type: () => User })
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @ApiProperty({ type: () => Media })
  @ManyToOne(() => Media, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mediaId' })
  media: Media;

  @ApiProperty()
  @Column({ name: 'mediaId', type: 'int' })
  mediaId: number;

  @ApiProperty()
  @Column({ name: 'description', type: 'text' })
  description: string;

  @ApiProperty({ type: Number, nullable: true })
  @Column({
    name: 'latitude',
    type: 'numeric',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: numericTransformer,
  })
  latitude: number | null;

  @ApiProperty({ type: Number, nullable: true })
  @Column({
    name: 'longitude',
    type: 'numeric',
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: numericTransformer,
  })
  longitude: number | null;

  @ApiProperty({ enum: WasteCategory, nullable: true })
  @Index('IDX_reports_predictedCategory')
  @Column({
    name: 'predictedCategory',
    type: 'enum',
    enum: WasteCategory,
    enumName: 'reports_predicted_category_enum',
    nullable: true,
  })
  predictedCategory: WasteCategory | null;

  @ApiProperty({ type: Number, nullable: true })
  @Column({
    name: 'confidence',
    type: 'numeric',
    precision: 5,
    scale: 4,
    nullable: true,
    transformer: numericTransformer,
  })
  confidence: number | null;

  @ApiProperty({ nullable: true })
  @Column({ name: 'modelVersion', type: 'varchar', nullable: true })
  modelVersion: string | null;

  @ApiProperty({ enum: ClassificationStatus })
  @Column({
    name: 'classificationStatus',
    type: 'enum',
    enum: ClassificationStatus,
    enumName: 'reports_classification_status_enum',
    default: ClassificationStatus.COMPLETED,
  })
  classificationStatus: ClassificationStatus;

  @ApiProperty({ nullable: true })
  @Column({ name: 'classificationError', type: 'varchar', nullable: true })
  classificationError: string | null;

  @ApiProperty({ enum: ReportStatus })
  @Index('IDX_reports_status')
  @Column({
    name: 'status',
    type: 'enum',
    enum: ReportStatus,
    enumName: 'reports_status_enum',
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @ApiProperty()
  @Index('IDX_reports_createdAt')
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
