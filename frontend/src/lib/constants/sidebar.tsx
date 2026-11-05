import {
  Bell,
  Database,
  Image as ImageIcon,
  Key,
  KeyRound,
  LayoutDashboard,
  Mail,
  MonitorSmartphone,
  Recycle,
  ScrollText,
  Shield,
  Users,
} from 'lucide-react'

export const SIDEBAR_EXPANDED_WIDTH = 260
export const SIDEBAR_COLLAPSED_WIDTH = 70

export const MENU_PERMISSIONS = {
  dashboard: 'menu.dashboard',
  reports: 'menu.reports',
  users: 'menu.users',
  database: 'menu.database',
  roles: 'menu.roles',
  permissions: 'menu.permissions',
  media: 'menu.media',
  invitations: 'menu.invitations',
  oauth: 'menu.oauth',
  sessions: 'menu.sessions',
  audit: 'menu.audit',
} as const

export type MenuPermissionKey =
  (typeof MENU_PERMISSIONS)[keyof typeof MENU_PERMISSIONS]

export type NavItem = {
  key: string
  label: string
  icon: React.ReactNode
  href?: string
  permission?: string | Array<string>
  menuPermission?: MenuPermissionKey
  children?: Array<NavItem>
}
export type NavGroup = { title: string; items: Array<NavItem> }

export const sidebarData: Array<NavGroup> = [
  {
    title: 'Main',
    items: [
      {
        key: 'dashboard',
        icon: <LayoutDashboard size={20} />,
        label: 'Dashboard',
        href: '/',
        menuPermission: MENU_PERMISSIONS.dashboard,
      },
      {
        key: 'reports',
        icon: <Recycle size={20} />,
        label: 'Reports',
        href: '/reports',
        menuPermission: MENU_PERMISSIONS.reports,
        permission: ['reports.read.own', 'reports.read.all'],
      },
    ],
  },
  {
    title: 'Management',
    items: [
      {
        key: 'users',
        icon: <Users size={20} />,
        label: 'Users',
        href: '/users',
        menuPermission: MENU_PERMISSIONS.users,
        permission: 'users.read',
      },
      {
        key: 'invitations',
        icon: <Mail size={20} />,
        label: 'Invitations',
        href: '/invitations',
        menuPermission: MENU_PERMISSIONS.invitations,
        permission: 'users.invite',
      },
      {
        key: 'database',
        icon: <Database size={20} />,
        label: 'Database',
        menuPermission: MENU_PERMISSIONS.database,
        children: [
          {
            key: 'roles',
            icon: <Shield size={18} />,
            label: 'Roles',
            href: '/roles',
            menuPermission: MENU_PERMISSIONS.roles,
            permission: 'roles.read',
          },
          {
            key: 'permissions',
            icon: <Key size={18} />,
            label: 'Permissions',
            href: '/permissions',
            menuPermission: MENU_PERMISSIONS.permissions,
            permission: 'permissions.read',
          },
          {
            key: 'oauth-clients',
            icon: <KeyRound size={18} />,
            label: 'OAuth Clients',
            href: '/oauth-clients',
            menuPermission: MENU_PERMISSIONS.oauth,
            permission: 'oauth.clients.read',
          },
        ],
      },
      {
        key: 'media',
        icon: <ImageIcon size={20} />,
        label: 'Media Library',
        href: '/media',
        menuPermission: MENU_PERMISSIONS.media,
        permission: 'media.read',
      },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      {
        key: 'audit-logs',
        icon: <ScrollText size={20} />,
        label: 'Audit Trail',
        href: '/audit-logs',
        menuPermission: MENU_PERMISSIONS.audit,
        permission: 'audit.read',
      },
      {
        key: 'sessions',
        icon: <MonitorSmartphone size={20} />,
        label: 'Sessions',
        href: '/sessions',
        menuPermission: MENU_PERMISSIONS.sessions,
        permission: 'sessions.read',
      },
    ],
  },
  {
    title: 'Others',
    items: [
      {
        key: 'notifications',
        icon: <Bell size={20} />,
        label: 'Notifications',
        href: '/notifications',
      },
    ],
  },
]
