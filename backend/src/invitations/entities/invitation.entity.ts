import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity('invitations')
export class Invitation {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index()
  @Column({ name: 'token', unique: true })
  token: string;

  @ApiProperty()
  @Index()
  @Column({ name: 'email' })
  email: string;

  @ApiPropertyOptional({ type: [Number] })
  @Column({ name: 'roleIds', type: 'simple-json', nullable: true })
  roleIds: number[] | null;

  @ApiPropertyOptional()
  @Column({ name: 'invitedBy', type: 'int', nullable: true })
  invitedBy: number | null;

  @ApiProperty()
  @Column({ name: 'expiresAt', type: 'timestamptz', precision: 3 })
  expiresAt: Date;

  @ApiPropertyOptional()
  @Column({
    name: 'acceptedAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  acceptedAt: Date | null;

  @ApiProperty()
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date | null;
}
