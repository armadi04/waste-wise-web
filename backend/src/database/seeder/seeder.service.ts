import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../../permissions/entities/permission.entity';
import { Role } from '../../roles/entities/role.entity';
import { RegisterMethodEnum } from '@/users/register-method.enum';
import { User } from '../../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { PortalSeedService } from '@/portal/seed/portal-seed.service';
import type { PermissionType } from '@/auth/permissions.type';

/**
 * Every permission the app ships with. Exported so the e2e database cleaner can
 * preserve exactly this set between tests — when the two lists were maintained
 * separately, a newly seeded permission was silently deleted before each test
 * and its guard then rejected the superadmin.
 */
const CRUD = ['create', 'read', 'update', 'delete'] as const;
type CrudAction = (typeof CRUD)[number];
const CRUD_LABELS: Record<CrudAction, string> = {
  create: 'Create',
  read: 'Read',
  update: 'Update',
  delete: 'Delete',
};

/** Read-mostly customer/system portal data plus its dedicated audited actions. */
export const PORTAL_RECORD_PERMISSIONS: Array<{
  name: PermissionType;
  description: string;
}> = [
  { name: 'portal.customers.read', description: 'Read portal customers' },
  { name: 'portal.gifts.read', description: 'Read portal gifts' },
  {
    name: 'portal.gifts.revoke',
    description: 'Revoke unredeemed portal gifts',
  },
  { name: 'portal.referrals.read', description: 'Read portal referrals' },
  { name: 'portal.wallets.read', description: 'Read portal wallets' },
  {
    name: 'portal.wallets.adjust',
    description: 'Manually adjust portal wallet balances',
  },
  {
    name: 'portal.wallet_transactions.read',
    description: 'Read portal wallet transactions',
  },
  { name: 'portal.saved_offers.read', description: 'Read portal saved offers' },
  {
    name: 'portal.campaign_ledger.read',
    description: 'Read the portal campaign points ledger',
  },
  {
    name: 'portal.commerce_outbox.read',
    description: 'Read the portal commerce event outbox',
  },
];

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
  { name: 'menu.oauth', description: 'View OAuth clients in sidebar' },
  { name: 'menu.sessions', description: 'View sessions in sidebar' },
  { name: 'menu.audit', description: 'View the audit trail in sidebar' },

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

  // OAuth2 client permissions (client_credentials management)
  { name: 'oauth.clients.read', description: 'Read OAuth clients' },
  { name: 'oauth.clients.create', description: 'Register OAuth clients' },
  { name: 'oauth.clients.update', description: 'Update OAuth clients' },
  { name: 'oauth.clients.delete', description: 'Revoke OAuth clients' },

  // Session permissions
  { name: 'sessions.read', description: 'Read every user session' },
  { name: 'sessions.delete', description: 'Revoke any user session' },

  // Audit trail
  { name: 'audit.read', description: 'Read the audit trail' },

  // Dashboard
  { name: 'stats.read', description: 'Read dashboard statistics' },

  // Portal administration
  { name: 'menu.portal', description: 'View portal management in sidebar' },
  { name: 'portal.dashboard.read', description: 'Read portal dashboard' },
  ...(<Array<[string, string, ReadonlyArray<CrudAction>]>>[
    ['coupons', 'coupons', CRUD],
    ['events', 'events', CRUD],
    ['event_tickets', 'event tickets', CRUD],
    ['bundles', 'bundles', CRUD],
    ['campaigns', 'campaigns', CRUD],
    ['faqs', 'FAQs', CRUD],
    ['vouchers', 'vouchers', CRUD],
    ['tickets', 'tickets', CRUD],
    ['orders', 'orders', CRUD],
    ['order_items', 'order items', CRUD],
    ['follows', 'follows', CRUD],
    // Progress changes only through the audited points ledger (adjust).
    ['campaign_progress', 'campaign progress', ['read']],
    ['email_otp_challenges', 'email OTP challenges', CRUD],
    ['reviews', 'reviews', ['read', 'update', 'delete']],
    ['promo_codes', 'promo codes', CRUD],
    ['booking_slots', 'booking slots', CRUD],
    ['bookings', 'bookings', ['read', 'update', 'delete']],
    ['coupon_categories', 'coupon categories', CRUD],
    ['cities', 'cities', CRUD],
    ['content', 'site content', ['read', 'update']],
    ['broadcasts', 'customer broadcasts', ['create', 'read']],
  ]).flatMap(([key, label, actions]) =>
    actions.map((action) => ({
      name: `portal.${key}.${action}` as PermissionType,
      description: `${CRUD_LABELS[action]} portal ${label}`,
    })),
  ),
  {
    name: 'portal.vouchers.redeem',
    description: 'Redeem portal vouchers by id or QR scan',
  },
  {
    name: 'portal.tickets.check_in',
    description: 'Check in portal tickets by id or QR scan',
  },
  {
    name: 'portal.orders.refund',
    description: 'Approve or reject portal order refunds',
  },
  {
    name: 'portal.campaign_progress.adjust',
    description: 'Adjust portal campaign points through the ledger',
  },
  ...PORTAL_RECORD_PERMISSIONS,
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
    private readonly portalSeedService: PortalSeedService,
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
    await this.portalSeedService.seed();
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
        permissions: getPermissions('menu.dashboard', 'media.read'),
      });
      await this.roleRepository.save(userRole);
      this.logger.log('Created user role.');
    } else {
      userRole.permissions = getPermissions('menu.dashboard', 'media.read');
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
  }
}
