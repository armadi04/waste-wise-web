import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * An OAuth2 client for the `client_credentials` grant — a machine consumer
 * (third-party integration, mobile backend, service) that authenticates with a
 * client id + secret and receives a scoped access token. Scopes are permission
 * strings from the same catalog as user RBAC, so `@Permissions()` guards apply
 * uniformly to user and client principals.
 */
@Entity('oauth_clients')
export class OAuthClient {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @ApiProperty()
  @Index()
  @Column({ name: 'clientId', unique: true })
  clientId: string;

  /** bcrypt hash of the client secret — never returned to clients. */
  @Exclude()
  @Column({ name: 'clientSecret' })
  clientSecret: string;

  @ApiProperty()
  @Column({ name: 'name' })
  name: string;

  @ApiProperty({ type: [String], description: 'Granted permission scopes.' })
  @Column({ name: 'scopes', type: 'simple-array', default: '' })
  scopes: string[];

  @ApiProperty()
  @Column({ name: 'isActive', default: true })
  isActive: boolean;

  @ApiProperty()
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @Exclude()
  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date;
}
