import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../../permissions/entities/permission.entity';
import { Role } from '../../roles/entities/role.entity';
import { RegisterMethodEnum } from '@/users/register-method.enum';
import { User } from '../../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import type { PermissionType } from '@/auth/permissions.type';
import { resolveDemoUser } from './demo-user';

/**
 * Every permission the app ships with. Exported so the e2e database cleaner can
 * preserve exactly this set between tests — when the two lists were maintained
 * separately, a newly seeded permission was silently deleted before each test
 * and its guard then rejected the superadmin.
 */
export const SEEDED_PERMISSIONS: Array<{
  name: PermissionType;
  description: string;
}> = [
  // Menu permissions (control sidebar visibility)
  { name: 'menu.dashboard', description: 'View dashboard in sidebar' },
  { name: 'menu.users', description: 'View users in sidebar' },
  { name: 'menu.database', description: 'View database section in sidebar' },
  { name: 'menu.roles', description: 'View roles in sidebar' },
  { name: 'menu.permissions', description: 'View permissions in sidebar' },
  { name: 'menu.media', description: 'View media library in sidebar' },
  { name: 'menu.invitations', description: 'View invitations in sidebar' },
  { name: 'menu.sessions', description: 'View sessions in sidebar' },
  { name: 'menu.audit', description: 'View the audit trail in sidebar' },
  { name: 'menu.reports', description: 'View reports in sidebar' },

  // App-wide operations
  {
    name: 'app.force_refresh',
    description: 'Tell every connected client to drop its cache and reload',
  },

  // User permissions
  { name: 'users.invite', description: 'Invite new users' },
  { name: 'users.read', description: 'Read user details' },
  { name: 'users.update', description: 'Update user details' },
  { name: 'users.delete', description: 'Delete users' },
  {
    name: 'users.manage_roles',
    description: 'Manage user roles (sync, attach, detach)',
  },
  {
    name: 'users.impersonate',
    description: 'Sign in as another user (impersonation)',
  },
  {
    name: 'users.manage_permissions',
    description: 'Manage user permissions (sync, attach, detach)',
  },
  {
    name: 'users.manage_status',
    description: 'Activate or deactivate user accounts',
  },

  // Role permissions
  { name: 'roles.create', description: 'Create new roles' },
  { name: 'roles.read', description: 'Read role details' },
  { name: 'roles.update', description: 'Update role details' },
  { name: 'roles.delete', description: 'Delete roles' },
  {
    name: 'roles.manage_permissions',
    description: 'Manage role permissions (sync, attach, detach)',
  },

  // Permission permissions
  { name: 'permissions.create', description: 'Create new permissions' },
  { name: 'permissions.read', description: 'Read permission details' },
  { name: 'permissions.update', description: 'Update permission details' },
  { name: 'permissions.delete', description: 'Delete permissions' },

  // Media permissions
  { name: 'media.create', description: 'Upload media files' },
  { name: 'media.read', description: 'Read media files' },
  {
    name: 'media.read_all',
    description: 'Read all media files regardless of ownership',
  },
  {
    name: 'media.delete_all',
    description: 'Delete all media files regardless of ownership',
  },
  { name: 'media.delete', description: 'Delete media files' },

  // Session permissions
  { name: 'sessions.read', description: 'Read every user session' },
  { name: 'sessions.delete', description: 'Revoke any user session' },

  // Audit trail
  { name: 'audit.read', description: 'Read the audit trail' },

  // Reports
  { name: 'reports.create', description: 'Create reports' },
  { name: 'reports.read.own', description: 'Read own reports' },
  { name: 'reports.read.all', description: 'Read all reports' },
  { name: 'reports.update.own', description: 'Update own pending reports' },
  { name: 'reports.update.all', description: 'Update all reports' },
  { name: 'reports.delete.own', description: 'Delete own pending reports' },
  { name: 'reports.delete.all', description: 'Delete all reports' },
  {
    name: 'reports.status.update',
    description: 'Update report handling status',
  },

  // Dashboard
  { name: 'stats.read', description: 'Read dashboard statistics' },
];

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.DB_SEED === 'false'
    ) {
      this.logger.log('Skipping automatic seeding...');
      return;
    }
    await this.seed();
  }

  async seed() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database seed is disabled in production.');
    }
    this.logger.log('Seeding data...');
    await this.seedPermissions();
    await this.seedRoles();
    await this.seedUsers();
    this.logger.log('Seeding complete!');
  }

  private async seedPermissions() {
    for (const p of SEEDED_PERMISSIONS) {
      const existing = await this.permissionRepository.findOneBy({
        name: p.name,
      });
      if (!existing) {
        await this.permissionRepository.save(
          this.permissionRepository.create(p),
        );
      }
    }
    this.logger.log(`Seeded ${SEEDED_PERMISSIONS.length} permissions.`);
  }

  private async seedRoles() {
    const allPermissions = await this.permissionRepository.find();

    const getPermissions = (...names: string[]) =>
      allPermissions.filter((p) => names.includes(p.name));

    // Superadmin — all permissions
    let adminRole = await this.roleRepository.findOne({
      where: [{ name: 'superadmin' }, { name: 'admin' }],
      relations: { permissions: true },
    });

    if (!adminRole) {
      adminRole = this.roleRepository.create({
        name: 'superadmin',
        description: 'Administrator with full access',
        permissions: allPermissions,
      });
      await this.roleRepository.save(adminRole);
      this.logger.log('Created superadmin role.');
    } else {
      adminRole.name = 'superadmin';
      adminRole.permissions = allPermissions;
      await this.roleRepository.save(adminRole);
      this.logger.log('Updated superadmin role permissions.');
    }

    // Standard user — basic read access
    let userRole = await this.roleRepository.findOneBy({ name: 'user' });
    if (!userRole) {
      userRole = this.roleRepository.create({
        name: 'user',
        description: 'Standard user with base access',
        permissions: getPermissions(
          'menu.dashboard',
          'menu.reports',
          'media.read',
          'media.create',
          'reports.create',
          'reports.read.own',
          'reports.update.own',
          'reports.delete.own',
        ),
      });
      await this.roleRepository.save(userRole);
      this.logger.log('Created user role.');
    } else {
      userRole.permissions = getPermissions(
        'menu.dashboard',
        'menu.reports',
        'media.read',
        'media.create',
        'reports.create',
        'reports.read.own',
        'reports.update.own',
        'reports.delete.own',
      );
      await this.roleRepository.save(userRole);
      this.logger.log('Updated user role permissions.');
    }
  }

  private async seedUsers() {
    const adminRole = await this.roleRepository.findOneBy({
      name: 'superadmin',
    });
    const adminEmail = process.env.ADMIN_EMAIL!;
    const adminPassword = process.env.ADMIN_PASSWORD!;

    const existingAdmin = await this.userRepository.findOneBy({
      email: adminEmail,
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      const adminUser = this.userRepository.create({
        email: adminEmail,
        password: hashedPassword,
        fullname: 'System Administrator',
        registerMethod: RegisterMethodEnum.SEEDER,
        roles: [adminRole!],
        emailVerifiedAt: new Date(),
      });
      await this.userRepository.save(adminUser);
      this.logger.log(`Created default superadmin user: ${adminEmail}`);
    }

    const demo = resolveDemoUser(process.env);
    if (demo) {
      const existingDemo = await this.userRepository.findOneBy({
        email: demo.email,
      });
      if (!existingDemo) {
        const userRole = await this.roleRepository.findOneBy({ name: 'user' });
        const hashedPassword = await bcrypt.hash(demo.password, 10);
        const demoUser = this.userRepository.create({
          email: demo.email,
          password: hashedPassword,
          fullname: 'Demo User',
          registerMethod: RegisterMethodEnum.SEEDER,
          roles: userRole ? [userRole] : [],
          emailVerifiedAt: new Date(),
        });
        await this.userRepository.save(demoUser);
        this.logger.log(`Created demo user: ${demo.email}`);
      }
    }
  }
}
