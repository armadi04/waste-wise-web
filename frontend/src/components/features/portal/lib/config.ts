import type { PortalResource, PortalValue } from '@/types/portal'

export type PortalFieldType =
  | 'timezone'
  | 'text'
  | 'textarea'
  | 'number'
  | 'datetime'
  | 'boolean'
  | 'email'
  | 'select'
  | 'lookup'

export interface PortalField {
  key: string
  label: string
  type: PortalFieldType
  required?: boolean
  autoSlug?: boolean
  readOnly?: boolean
  createWritable?: boolean
  createDefault?: PortalValue
  nullable?: boolean
  description?: string
  options?: Array<string>
  /** For `lookup`: choose the `name` of an active record of this resource. */
  lookup?: PortalResource
}

/** Writes the backend accepts for a resource; omitted keys default to allowed. */
export interface PortalCapabilities {
  create?: boolean
  update?: boolean
  delete?: boolean
  bulkDelete?: boolean
}

export interface PortalResourceConfig {
  resource: PortalResource
  label: string
  singular: string
  permission: string
  fields: Array<PortalField>
  capabilities?: PortalCapabilities
  partialUpdate?: boolean
}

const text = (
  key: string,
  label: string,
  required = true,
  autoSlug = false,
): PortalField => ({
  key,
  label,
  type: 'text',
  required,
  autoSlug,
})

const number = (key: string, label: string, required = true): PortalField => ({
  key,
  label,
  type: 'number',
  required,
})

const date = (key: string, label: string, required = true): PortalField => ({
  key,
  label,
  type: 'datetime',
  required,
})

const area = (key: string, label: string, required = true): PortalField => ({
  key,
  label,
  type: 'textarea',
  required,
})

const select = (
  key: string,
  label: string,
  options: Array<string>,
  required = true,
): PortalField => ({
  key,
  label,
  type: 'select',
  options,
  required,
})

const readOnly = (field: PortalField): PortalField => ({
  ...field,
  readOnly: true,
})

const lookup = (
  key: string,
  label: string,
  resource: PortalResource,
): PortalField => ({
  key,
  label,
  type: 'lookup',
  lookup: resource,
  required: true,
})

/** Lucide icon keys the portal renders for category lanes (backend CATEGORY_ICONS). */
export const CATEGORY_ICONS = [
  'utensils',
  'music',
  'armchair',
  'coffee',
  'beer',
  'film',
  'ticket',
  'sparkles',
  'moon',
  'gamepad',
  'shopping-bag',
  'dumbbell',
  'heart',
]

const active: PortalField = { key: 'active', label: 'Active', type: 'boolean' }

const checkoutOwned: PortalCapabilities = {
  create: false,
  delete: false,
  bulkDelete: false,
}
const READ_ONLY: PortalCapabilities = {
  create: false,
  update: false,
  delete: false,
  bulkDelete: false,
}

export const portalResourceConfigs: Array<PortalResourceConfig> = [
  {
    resource: 'coupons',
    label: 'Coupons',
    singular: 'Coupon',
    permission: 'portal.coupons',
    fields: [
      text('slug', 'Slug', false, true),
      text('title', 'Title'),
      text('merchant', 'Merchant'),
      { key: 'timeZone', label: 'Business timezone', type: 'timezone' },
      lookup('city', 'City', 'cities'),
      text('location', 'Location'),
      lookup('category', 'Category', 'coupon-categories'),
      {
        ...number('price', 'Starting price'),
        readOnly: true,
        createWritable: true,
      },
      {
        ...number('oldPrice', 'Old price', false),
        readOnly: true,
        createWritable: true,
      },
      { ...text('discount', 'Discount', false), readOnly: true },
      {
        ...date(
          'expiresAt',
          'Fixed voucher expiry (required without duration)',
          false,
        ),
        nullable: true,
      },
      { ...date('salesEndsAt', 'Sales end', false), nullable: true },
      {
        ...number(
          'validityDays',
          'Validity days since issuance (optional)',
          false,
        ),
        nullable: true,
        description:
          'Leave empty for fixed expiry. Duration vouchers require a sales end; fixed expiry is ignored.',
      },
      {
        ...number('maxPerOrder', 'Maximum per order (optional)', false),
        nullable: true,
      },
      {
        ...number('maxPerUser', 'Maximum per user (optional)', false),
        nullable: true,
      },
      {
        ...number('stockTotal', 'Total stock'),
        readOnly: true,
        createWritable: true,
      },
      {
        ...number('stockRemaining', 'Remaining stock'),
        readOnly: true,
        createWritable: true,
      },
      {
        ...text('imageUrl', 'Cover image'),
        readOnly: true,
        createWritable: true,
      },
      area('description', 'Description'),
      area('benefits', 'Benefits'),
      area('terms', 'Terms'),
      area('redemption', 'Redemption'),
      active,
    ],
  },
  {
    resource: 'events',
    label: 'Events',
    singular: 'Event',
    permission: 'portal.events',
    fields: [
      text('slug', 'Slug', false, true),
      text('title', 'Title'),
      text('type', 'Type'),
      text('dateLabel', 'Date label'),
      { key: 'timeZone', label: 'Business timezone', type: 'timezone' },
      {
        ...number('maxPerOrder', 'Maximum per order (optional)', false),
        nullable: true,
      },
      {
        ...number('maxPerUser', 'Maximum per user (optional)', false),
        nullable: true,
      },
      text('monthLabel', 'Month label'),
      text('dayLabel', 'Day label'),
      date('startsAt', 'Starts at'),
      text('venue', 'Venue'),
      lookup('city', 'City', 'cities'),
      text('timeLabel', 'Time label'),
      number('basePrice', 'Base price'),
      text('statusLabel', 'Status label'),
      text('imageUrl', 'Image URL'),
      area('description', 'Description'),
      active,
    ],
  },
  {
    resource: 'event-tickets',
    label: 'Event tickets',
    singular: 'Event ticket',
    permission: 'portal.event_tickets',
    fields: [
      number('eventId', 'Event ID'),
      text('name', 'Name'),
      text('description', 'Description'),
      number('price', 'Price'),
      number('stockTotal', 'Stock total'),
      readOnly(number('stockRemaining', 'Stock remaining')),
      {
        ...date('salesEndsAt', 'Ticket sales end (optional)', false),
        nullable: true,
      },
      text('statusLabel', 'Status label'),
    ],
  },
  {
    resource: 'bundles',
    label: 'Bundles',
    singular: 'Bundle',
    permission: 'portal.bundles',
    fields: [
      text('slug', 'Slug', false, true),
      text('title', 'Title'),
      area('description', 'Description'),
      text('couponSlug', 'Coupon slug'),
      text('eventSlug', 'Event slug'),
      number('price', 'Price'),
      { ...number('packageId', 'Coupon package', false), nullable: true },
      { ...number('ticketTypeId', 'Ticket type', false), nullable: true },
      {
        ...number('maxPerOrder', 'Maximum per order (optional)', false),
        nullable: true,
      },
      {
        ...number('maxPerUser', 'Maximum per user (optional)', false),
        nullable: true,
      },
      text('imageUrl', 'Image URL'),
      active,
    ],
  },
  {
    resource: 'campaigns',
    label: 'Campaigns',
    singular: 'Campaign',
    permission: 'portal.campaigns',
    fields: [
      text('slug', 'Slug', false, true),
      text('title', 'Title'),
      area('description', 'Description'),
      text('rewardLabel', 'Reward label'),
      text('imageUrl', 'Image URL'),
      number('targetPoints', 'Target points'),
      active,
    ],
  },
  {
    resource: 'faqs',
    label: 'FAQs',
    singular: 'FAQ',
    permission: 'portal.faqs',
    fields: [
      number('position', 'Position'),
      text('question', 'Question'),
      area('answer', 'Answer'),
      active,
    ],
  },
  {
    resource: 'vouchers',
    partialUpdate: true,
    label: 'Vouchers',
    singular: 'Voucher',
    permission: 'portal.vouchers',
    fields: [
      number('userId', 'User ID'),
      number('couponId', 'Coupon ID'),
      text('code', 'Code'),
      { ...readOnly(text('status', 'Status', false)), createDefault: 'Issued' },
      date('expiresAt', 'Expires at'),
      readOnly(date('redeemedAt', 'Redeemed at', false)),
      text('imageUrl', 'Image URL'),
    ],
  },
  {
    resource: 'tickets',
    partialUpdate: true,
    label: 'Tickets',
    singular: 'Ticket',
    permission: 'portal.tickets',
    fields: [
      number('userId', 'User ID'),
      number('eventId', 'Event ID'),
      number('ticketTypeId', 'Ticket type ID'),
      text('code', 'Code'),
      text('attendee', 'Attendee'),
      { ...readOnly(text('status', 'Status', false)), createDefault: 'Issued' },
      text('imageUrl', 'Image URL'),
      readOnly(date('checkedInAt', 'Checked in at', false)),
    ],
  },
  {
    resource: 'orders',
    label: 'Orders',
    singular: 'Order',
    permission: 'portal.orders',
    fields: [
      { ...number('userId', 'User ID'), readOnly: true },
      { ...text('orderNumber', 'Order number'), readOnly: true },
      { ...text('idempotencyKey', 'Idempotency key'), readOnly: true },
      { ...text('status', 'Status'), readOnly: true },
      { ...text('kind', 'Kind'), readOnly: true },
      { ...number('total', 'Total'), readOnly: true },
      { ...text('currency', 'Currency'), readOnly: true },
      text('title', 'Title'),
      area('meta', 'Meta'),
      { ...number('quantity', 'Quantity'), readOnly: true },
      { ...text('paymentState', 'Payment state', false), readOnly: true },
      {
        ...area('purchaseSnapshot', 'Purchase snapshot and allocation', false),
        readOnly: true,
      },
      { ...text('refundStatus', 'Refund status', false), readOnly: true },
      { ...area('refundReason', 'Refund reason', false), readOnly: true },
      {
        ...date('refundRequestedAt', 'Refund requested at', false),
        readOnly: true,
      },
    ],
    capabilities: checkoutOwned,
  },
  {
    resource: 'order-items',
    label: 'Order items',
    singular: 'Order item',
    permission: 'portal.order_items',
    fields: [
      { ...number('orderId', 'Order ID'), readOnly: true },
      { ...text('productType', 'Product type'), readOnly: true },
      { ...number('productId', 'Product ID'), readOnly: true },
      text('title', 'Title'),
      { ...number('quantity', 'Quantity'), readOnly: true },
      { ...number('unitPrice', 'Unit price'), readOnly: true },
    ],
    capabilities: checkoutOwned,
  },
  {
    resource: 'follows',
    label: 'Follows',
    singular: 'Follow',
    permission: 'portal.follows',
    fields: [
      number('userId', 'User ID'),
      select('targetType', 'Target type', ['coupon', 'event', 'merchant']),
      text('targetKey', 'Target key'),
      text('targetName', 'Target name'),
      text('imageUrl', 'Image URL'),
    ],
  },
  {
    resource: 'campaign-progress',
    label: 'Campaign progress',
    singular: 'Campaign progress',
    permission: 'portal.campaign_progress',
    fields: [
      number('userId', 'User ID'),
      number('campaignId', 'Campaign ID'),
      number('points', 'Points'),
      number('targetPoints', 'Target points'),
      text('status', 'Status'),
    ].map(readOnly),
    capabilities: READ_ONLY,
  },
  {
    resource: 'otp-challenges',
    label: 'OTP challenges',
    singular: 'OTP challenge',
    permission: 'portal.email_otp_challenges',
    fields: [
      text('email', 'Email'),
      text('purpose', 'Purpose'),
      date('expiresAt', 'Expires at'),
      number('attempts', 'Attempts'),
      date('consumedAt', 'Consumed at', false),
      text('requestIp', 'Request IP', false),
      date('lastSentAt', 'Last sent at', false),
    ],
  },
  {
    resource: 'reviews',
    label: 'Reviews',
    singular: 'Review',
    permission: 'portal.reviews',
    fields: [
      ...[
        number('userId', 'User ID'),
        select('targetType', 'Target type', ['coupon', 'event', 'merchant']),
        text('targetKey', 'Target key'),
        text('authorName', 'Author'),
        number('rating', 'Rating'),
        area('body', 'Review'),
      ].map(readOnly),
      { key: 'verified', label: 'Verified purchase', type: 'boolean' },
      { ...area('merchantReply', 'Merchant reply', false), nullable: true },
    ],
    capabilities: { create: false },
  },
  {
    resource: 'promo-codes',
    label: 'Promo codes',
    singular: 'Promo code',
    permission: 'portal.promo_codes',
    fields: [
      {
        ...text('code', 'Code'),
        description:
          'Stored uppercase. Campaign reward codes are managed by the campaign engine.',
      },
      select('kind', 'Kind', ['percentage', 'fixed']),
      number('value', 'Value'),
      number('minimumOrder', 'Minimum order', false),
      {
        ...number('maximumDiscount', 'Maximum discount (optional)', false),
        nullable: true,
      },
      {
        ...number('usageLimit', 'Usage limit (optional)', false),
        nullable: true,
      },
      readOnly(number('usageCount', 'Usage count', false)),
      date('expiresAt', 'Expires at'),
      active,
    ],
  },
  {
    resource: 'booking-slots',
    label: 'Booking slots',
    singular: 'Booking slot',
    permission: 'portal.booking_slots',
    fields: [
      number('eventId', 'Event ID'),
      date('startsAt', 'Starts at'),
      date('endsAt', 'Ends at'),
      number('capacity', 'Capacity'),
      readOnly(number('remaining', 'Remaining', false)),
      select('status', 'Status', ['Available', 'Full', 'Closed'], false),
    ],
  },
  {
    resource: 'bookings',
    label: 'Bookings',
    singular: 'Booking',
    permission: 'portal.bookings',
    fields: [
      ...[
        number('userId', 'User ID'),
        number('eventId', 'Event ID'),
        number('slotId', 'Slot ID'),
      ].map(readOnly),
      text('attendee', 'Attendee'),
      select('status', 'Status', [
        'Reserved',
        'Confirmed',
        'Cancelled',
        'Completed',
      ]),
    ],
    capabilities: { create: false },
  },
  {
    resource: 'customers',
    label: 'Customers',
    singular: 'Customer',
    permission: 'portal.customers',
    fields: [
      text('email', 'Email'),
      text('fullname', 'Name'),
      number('orderCount', 'Orders'),
      number('walletBalance', 'Wallet balance'),
      number('paidOrderCount', 'Paid orders'),
      date('lastOrderAt', 'Last order'),
      text('phone', 'Phone'),
      text('registerMethod', 'Registered via'),
      {
        key: 'notificationsEnabled',
        label: 'Notifications enabled',
        type: 'boolean',
      } as PortalField,
      date('createdAt', 'Joined at'),
    ].map(readOnly),
    capabilities: READ_ONLY,
  },
  {
    resource: 'gifts',
    label: 'Gifts',
    singular: 'Gift',
    permission: 'portal.gifts',
    fields: [
      text('code', 'Code'),
      text('recipientEmail', 'Recipient email'),
      text('status', 'Status'),
      number('senderUserId', 'Sender user ID'),
      text('recipientName', 'Recipient name'),
      number('recipientUserId', 'Recipient user ID'),
      number('couponId', 'Coupon ID'),
      date('expiresAt', 'Expires at'),
      date('redeemedAt', 'Redeemed at'),
      area('message', 'Message'),
    ].map(readOnly),
    capabilities: READ_ONLY,
  },
  {
    resource: 'referrals',
    label: 'Referrals',
    singular: 'Referral',
    permission: 'portal.referrals',
    fields: [
      number('userId', 'User ID'),
      text('code', 'Code'),
      number('referrerUserId', 'Referred by user ID'),
      number('firstOrderId', 'First order ID'),
      date('createdAt', 'Created at'),
    ].map(readOnly),
    capabilities: READ_ONLY,
  },
  {
    resource: 'wallets',
    label: 'Wallets',
    singular: 'Wallet',
    permission: 'portal.wallets',
    fields: [
      number('userId', 'User ID'),
      number('balance', 'Balance'),
      number('lifetimeEarned', 'Lifetime earned'),
    ].map(readOnly),
    capabilities: READ_ONLY,
  },
  {
    resource: 'wallet-transactions',
    label: 'Wallet transactions',
    singular: 'Wallet transaction',
    permission: 'portal.wallet_transactions',
    fields: [
      number('userId', 'User ID'),
      text('type', 'Type'),
      number('amount', 'Amount'),
      text('description', 'Description'),
      date('createdAt', 'Created at'),
    ].map(readOnly),
    capabilities: READ_ONLY,
  },
  {
    resource: 'saved-offers',
    label: 'Saved offers',
    singular: 'Saved offer',
    permission: 'portal.saved_offers',
    fields: [
      number('userId', 'User ID'),
      text('targetType', 'Target type'),
      text('targetName', 'Target name'),
      text('targetKey', 'Target key'),
      date('createdAt', 'Saved at'),
    ].map(readOnly),
    capabilities: READ_ONLY,
  },
  {
    resource: 'campaign-ledger',
    label: 'Campaign ledger',
    singular: 'Ledger entry',
    permission: 'portal.campaign_ledger',
    fields: [
      number('userId', 'User ID'),
      number('campaignId', 'Campaign ID'),
      text('kind', 'Kind'),
      number('points', 'Points'),
      area('reason', 'Reason'),
      text('sourceKey', 'Source key'),
      number('orderId', 'Order ID'),
      number('actorId', 'Actor user ID'),
      date('createdAt', 'Recorded at'),
    ].map(readOnly),
    capabilities: READ_ONLY,
  },
  {
    resource: 'commerce-outbox',
    label: 'Commerce outbox',
    singular: 'Outbox event',
    permission: 'portal.commerce_outbox',
    fields: [
      text('eventName', 'Event'),
      text('operationKey', 'Operation key'),
      date('deliveredAt', 'Delivered at'),
      date('createdAt', 'Queued at'),
      area('payload', 'Payload'),
    ].map(readOnly),
    capabilities: READ_ONLY,
  },
  {
    resource: 'coupon-categories',
    label: 'Categories',
    singular: 'Category',
    permission: 'portal.coupon_categories',
    fields: [
      {
        ...text('name', 'Name'),
        description:
          'Exact label on coupons. Renaming updates every coupon in this category.',
      },
      {
        ...text('slug', 'Slug', false),
        description: 'Generated from the name when empty.',
      },
      {
        ...text('label', 'Home lane label', false),
        nullable: true,
        description: 'Short lane title, e.g. "Makan". Falls back to the name.',
      },
      { ...select('icon', 'Lane icon', CATEGORY_ICONS, false), nullable: true },
      number('position', 'Position', false),
      area('blurb', 'Lane blurb', false),
      { key: 'featured', label: 'Show as a home lane', type: 'boolean' },
      active,
    ],
  },
  {
    resource: 'cities',
    label: 'Cities',
    singular: 'City',
    permission: 'portal.cities',
    fields: [
      {
        ...text('name', 'Name'),
        description: 'Renaming updates every coupon and event in this city.',
      },
      {
        ...text('slug', 'Slug', false),
        description: 'Generated from the name when empty.',
      },
      number('position', 'Position', false),
      {
        key: 'featured',
        label: 'Pin to the top of city pickers',
        type: 'boolean',
      },
      active,
    ],
  },
  {
    resource: 'broadcasts',
    label: 'Broadcasts',
    singular: 'Broadcast',
    permission: 'portal.broadcasts',
    fields: [
      text('title', 'Title'),
      area('message', 'Message'),
      {
        ...text('link', 'Portal link (optional)', false),
        description: 'A portal path such as /campaigns/ramadan.',
      },
      select('type', 'Type', ['info', 'success', 'warning']),
      select('audience', 'Audience', ['all', 'userIds']),
      {
        ...text('userIdsText', 'Customer IDs (for audience userIds)', false),
        description: 'Comma-separated user IDs.',
      },
      readOnly(number('recipientCount', 'Recipients', false)),
      readOnly(number('createdById', 'Sent by user ID', false)),
      readOnly(date('createdAt', 'Sent at', false)),
    ],
    capabilities: {
      create: true,
      update: false,
      delete: false,
      bulkDelete: false,
    },
  },
]

const ALLOWED: Required<PortalCapabilities> = {
  create: true,
  update: true,
  delete: true,
  bulkDelete: true,
}

export const portalCapabilities = (
  config: PortalResourceConfig | undefined,
): Required<PortalCapabilities> => ({
  ...ALLOWED,
  ...config?.capabilities,
})

export const portalResourceConfig = (resource: string) =>
  portalResourceConfigs.find((item) => item.resource === resource)
