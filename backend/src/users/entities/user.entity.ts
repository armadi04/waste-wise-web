import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { Permission } from '../../permissions/entities/permission.entity';
import { Media } from '../../media/entities/media.entity';
import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { RegisterMethodEnum } from '../register-method.enum';

@Entity('users')
@Index('UQ_users_email_active', { synchronize: false })
export class User {
  @ApiProperty({ nullable: true })
  @Column({ name: 'timeZone', type: 'varchar', length: 100, nullable: true })
  timeZone: string | null;

  @ApiProperty({ nullable: true })
  @Column({
    name: 'lastDetectedTimeZone',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  lastDetectedTimeZone: string | null;

  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @ApiProperty()
  // Unique case-insensitively among live accounts: UQ_users_email_active is
  // ON (LOWER("email")) WHERE "deletedAt" IS NULL, which TypeORM can't
  // declare, so it lives in the starter baseline migration.
  @Index()
  @Column({ name: 'email' })
  email: string;

  @Exclude()
  @Column({ name: 'password' })
  password: string;

  @ApiProperty({ nullable: true })
  @Column({ name: 'fullname', type: 'varchar', nullable: true })
  fullname: string;

  @ApiProperty({ nullable: true })
  @Column({ name: 'phone', type: 'varchar', nullable: true })
  phone: string;

  @ApiProperty()
  @Column({ name: 'notificationsEnabled', type: 'boolean', default: true })
  notificationsEnabled: boolean;

  @ApiProperty({ type: () => Media, nullable: true })
  @OneToOne('Media')
  @JoinColumn({ name: 'avatarId' })
  avatar: Media;

  @ApiProperty({ type: () => [Media] })
  @OneToMany('Media', 'user')
  media: Media[];

  @ApiProperty({ type: () => [Role] })
  @ManyToMany(() => Role, (role) => role.users)
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
  })
  roles: Role[];

  @ApiProperty({ type: () => [Permission] })
  @ManyToMany(() => Permission)
  @JoinTable({
    name: 'user_permissions',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permissionId', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @ApiProperty({ nullable: true })
  @Column({
    name: 'emailVerifiedAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  emailVerifiedAt: Date | null;

  // Consecutive failed sign-in attempts (password or second factor). Reset on
  // any successful sign-in; drives `lockedUntil`.
  @Exclude()
  @Column({ name: 'failedLoginAttempts', type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Exclude()
  @Column({
    name: 'lockedUntil',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  lockedUntil: Date | null;

  // TOTP shared secret, encrypted at rest (see TwoFactorService). Present while
  // enrollment is pending as well as after it is confirmed — `twoFactorEnabledAt`
  // is what says the second factor is actually required at login.
  @Exclude()
  @Column({ name: 'twoFactorSecret', type: 'text', nullable: true })
  twoFactorSecret: string | null;

  @ApiProperty({ nullable: true })
  @Column({
    name: 'twoFactorEnabledAt',
    type: 'timestamptz',
    nullable: true,
    precision: 3,
  })
  twoFactorEnabledAt: Date | null;

  // Highest TOTP time-step already accepted, so a code can't be replayed inside
  // its validity window.
  @Exclude()
  @Column({ name: 'twoFactorLastStep', type: 'bigint', nullable: true })
  twoFactorLastStep: string | null;

  @ApiProperty({ enum: RegisterMethodEnum })
  @Index('IDX_users_registerMethod')
  @Column({
    name: 'registerMethod',
    type: 'enum',
    enum: RegisterMethodEnum,
    enumName: 'users_register_method_enum',
    default: RegisterMethodEnum.UNKNOWN,
  })
  registerMethod: RegisterMethodEnum;

  @ApiProperty()
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date;
}
