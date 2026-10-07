export type PortalResource =
  | 'coupons'
  | 'events'
  | 'event-tickets'
  | 'bundles'
  | 'campaigns'
  | 'faqs'
  | 'vouchers'
  | 'tickets'
  | 'orders'
  | 'order-items'
  | 'follows'
  | 'campaign-progress'
  | 'otp-challenges'
  | 'reviews'
  | 'promo-codes'
  | 'booking-slots'
  | 'bookings'
  | 'customers'
  | 'gifts'
  | 'referrals'
  | 'wallets'
  | 'wallet-transactions'
  | 'saved-offers'
  | 'campaign-ledger'
  | 'commerce-outbox'
  | 'coupon-categories'
  | 'cities'
  | 'broadcasts'

export interface CouponGalleryImage { url: string; alt: string }
export interface CouponPackageInput {
  publicId?: string
  name: string
  benefits: string
  price: number
  oldPrice: number | null
  stockTotal: number
  stockRemaining?: number
  issuedStock?: number
  active: boolean
  position?: number
}
export type PortalValue = Record<string, unknown> | string | number | boolean | null | Array<CouponGalleryImage> | Array<CouponPackageInput> | Array<number>

export interface PortalRecord {
  id: number
  [key: string]: PortalValue | undefined
}

export interface PortalDashboard {
  activeCoupons: number
  activeEvents: number
  activeBundles: number
  activeCampaigns: number
  activeFaqs: number
  pendingOrders: number
  vouchers: number
  tickets: number
  follows: number
  campaignProgress: number
  otpChallenges: number
  reviews: number
  activePromoCodes: number
  bookingSlots: number
  bookings: number
}
