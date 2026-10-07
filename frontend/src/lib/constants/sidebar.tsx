import {
  BadgePercent,
  Bell,
  BookOpen,
  BookText,
  Bookmark,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  Coins,
  Database,
  FileText,
  Gift,
  Heart,
  History,
  Image as ImageIcon,
  Inbox,
  Key,
  KeyRound,
  LayoutDashboard,
  ListOrdered,
  Mail,
  MapPin,
  Megaphone,
  MonitorSmartphone,
  Package,
  PanelsTopLeft,
  QrCode,
  ScanLine,
  ScrollText,
  Shapes,
  Share2,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Star,
  Tags,
  Ticket,
  TicketPercent,
  TrendingUp,
  UserRound,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react'

export const SIDEBAR_EXPANDED_WIDTH = 260
export const SIDEBAR_COLLAPSED_WIDTH = 70

// Menu permission keys — control sidebar visibility
export const MENU_PERMISSIONS = {
  dashboard: 'menu.dashboard',
  users: 'menu.users',
  database: 'menu.database',
  roles: 'menu.roles',
  permissions: 'menu.permissions',
  media: 'menu.media',
  invitations: 'menu.invitations',
  oauth: 'menu.oauth',
  sessions: 'menu.sessions',
  audit: 'menu.audit',
  portal: 'menu.portal',
} as const

export type MenuPermissionKey =
  (typeof MENU_PERMISSIONS)[keyof typeof MENU_PERMISSIONS]

export type NavItem = {
  key: string
  label: string
  icon: React.ReactNode
  href?: string
  /** Data-level permission for accessing the resource (e.g., 'media.read'); any listed one grants access */
  permission?: string | Array<string>
  /** Menu-level permission for showing/hiding in sidebar (e.g., 'menu.users') */
  menuPermission?: MenuPermissionKey
  children?: Array<NavItem>
}

export type NavGroup = {
  title: string
  items: Array<NavItem>
}

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
    ],
  },
  {
    title: 'Portal',
    items: [
      {
        key: 'portal',
        icon: <PanelsTopLeft size={20} />,
        label: 'Portal',
        href: '/portal',
        menuPermission: MENU_PERMISSIONS.portal,
        permission: 'portal.dashboard.read',
      },
      {
        key: 'portal-catalog',
        icon: <BookOpen size={20} />,
        label: 'Catalog',
        menuPermission: MENU_PERMISSIONS.portal,
        children: [
          {
            key: 'portal-coupons',
            icon: <TicketPercent size={18} />,
            label: 'Coupons',
            href: '/portal/coupons',
            permission: 'portal.coupons.read',
          },
          {
            key: 'portal-events',
            icon: <CalendarDays size={18} />,
            label: 'Events',
            href: '/portal/events',
            permission: 'portal.events.read',
          },
          {
            key: 'portal-event-tickets',
            icon: <Ticket size={18} />,
            label: 'Event Tickets',
            href: '/portal/event-tickets',
            permission: 'portal.event_tickets.read',
          },
          {
            key: 'portal-bundles',
            icon: <Package size={18} />,
            label: 'Bundles',
            href: '/portal/bundles',
            permission: 'portal.bundles.read',
          },
          {
            key: 'portal-campaigns',
            icon: <Megaphone size={18} />,
            label: 'Campaigns',
            href: '/portal/campaigns',
            permission: 'portal.campaigns.read',
          },
          {
            key: 'portal-content',
            icon: <FileText size={18} />,
            label: 'Site Content',
            href: '/portal/content',
            permission: 'portal.content.read',
          },
          {
            key: 'portal-broadcasts',
            icon: <Megaphone size={18} />,
            label: 'Broadcasts',
            href: '/portal/broadcasts',
            permission: 'portal.broadcasts.read',
          },
          {
            key: 'portal-faqs',
            icon: <CircleHelp size={18} />,
            label: 'FAQs',
            href: '/portal/faqs',
            permission: 'portal.faqs.read',
          },
          {
            key: 'portal-coupon-categories',
            icon: <Shapes size={18} />,
            label: 'Categories',
            href: '/portal/coupon-categories',
            permission: 'portal.coupon_categories.read',
          },
          {
            key: 'portal-cities',
            icon: <MapPin size={18} />,
            label: 'Cities',
            href: '/portal/cities',
            permission: 'portal.cities.read',
          },
          {
            key: 'portal-promo-codes',
            icon: <Tags size={18} />,
            label: 'Promo Codes',
            href: '/portal/promo-codes',
            permission: 'portal.promo_codes.read',
          },
          {
            key: 'portal-reviews',
            icon: <Star size={18} />,
            label: 'Reviews',
            href: '/portal/reviews',
            permission: 'portal.reviews.read',
          },
        ],
      },
      {
        key: 'portal-operations',
        icon: <ClipboardList size={20} />,
        label: 'Operations',
        menuPermission: MENU_PERMISSIONS.portal,
        children: [
          {
            key: 'portal-scan',
            icon: <ScanLine size={18} />,
            label: 'Scan Pass',
            href: '/portal/scan',
            permission: ['portal.vouchers.redeem', 'portal.tickets.check_in'],
          },
          {
            key: 'portal-orders',
            icon: <ShoppingCart size={18} />,
            label: 'Orders',
            href: '/portal/orders',
            permission: 'portal.orders.read',
          },
          {
            key: 'portal-order-items',
            icon: <ListOrdered size={18} />,
            label: 'Order Items',
            href: '/portal/order-items',
            permission: 'portal.order_items.read',
          },
          {
            key: 'portal-vouchers',
            icon: <BadgePercent size={18} />,
            label: 'Vouchers',
            href: '/portal/vouchers',
            permission: 'portal.vouchers.read',
          },
          {
            key: 'portal-tickets',
            icon: <QrCode size={18} />,
            label: 'Tickets',
            href: '/portal/tickets',
            permission: 'portal.tickets.read',
          },
          {
            key: 'portal-booking-slots',
            icon: <CalendarClock size={18} />,
            label: 'Booking Slots',
            href: '/portal/booking-slots',
            permission: 'portal.booking_slots.read',
          },
          {
            key: 'portal-bookings',
            icon: <CalendarCheck size={18} />,
            label: 'Bookings',
            href: '/portal/bookings',
            permission: 'portal.bookings.read',
          },
          {
            key: 'portal-follows',
            icon: <Heart size={18} />,
            label: 'Follows',
            href: '/portal/follows',
            permission: 'portal.follows.read',
          },
          {
            key: 'portal-campaign-progress',
            icon: <TrendingUp size={18} />,
            label: 'Campaign Progress',
            href: '/portal/campaign-progress',
            permission: 'portal.campaign_progress.read',
          },
          {
            key: 'portal-campaign-ledger',
            icon: <BookText size={18} />,
            label: 'Campaign Ledger',
            href: '/portal/campaign-ledger',
            permission: 'portal.campaign_ledger.read',
          },
          {
            key: 'portal-commerce-outbox',
            icon: <Inbox size={18} />,
            label: 'Commerce Outbox',
            href: '/portal/commerce-outbox',
            permission: 'portal.commerce_outbox.read',
          },
          {
            key: 'portal-otp-challenges',
            icon: <ShieldCheck size={18} />,
            label: 'OTP Challenges',
            href: '/portal/otp-challenges',
            permission: 'portal.email_otp_challenges.read',
          },
        ],
      },
      {
        key: 'portal-customers-group',
        icon: <UsersRound size={20} />,
        label: 'Customers',
        menuPermission: MENU_PERMISSIONS.portal,
        children: [
          {
            key: 'portal-customers',
            icon: <UserRound size={18} />,
            label: 'Customers',
            href: '/portal/customers',
            permission: 'portal.customers.read',
          },
          {
            key: 'portal-gifts',
            icon: <Gift size={18} />,
            label: 'Gifts',
            href: '/portal/gifts',
            permission: 'portal.gifts.read',
          },
          {
            key: 'portal-referrals',
            icon: <Share2 size={18} />,
            label: 'Referrals',
            href: '/portal/referrals',
            permission: 'portal.referrals.read',
          },
          {
            key: 'portal-wallets',
            icon: <Wallet size={18} />,
            label: 'Wallets',
            href: '/portal/wallets',
            permission: 'portal.wallets.read',
          },
          {
            key: 'portal-wallet-transactions',
            icon: <Coins size={18} />,
            label: 'Wallet Transactions',
            href: '/portal/wallet-transactions',
            permission: 'portal.wallet_transactions.read',
          },
          {
            key: 'portal-saved-offers',
            icon: <Bookmark size={18} />,
            label: 'Saved Offers',
            href: '/portal/saved-offers',
            permission: 'portal.saved_offers.read',
          },
        ],
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
      {
        key: 'changelog',
        icon: <History size={20} />,
        label: 'Changelog',
        href: '/changelog',
      },
    ],
  },
]

// Sidebar runtime state lives in `@/lib/stores/sidebar.store` (Zustand).
// This module only owns static navigation data, types, and width constants.
