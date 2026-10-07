import { z } from 'zod'

export const portalSearchSchema = z.object({
  page: z.number().optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  direction: z.enum(['asc', 'desc']).optional(),
})

export type PortalSearchParams = z.infer<typeof portalSearchSchema>

export const CUSTOMER_TABS = [
  'orders',
  'vouchers',
  'tickets',
  'bookings',
  'gifts',
  'wallet-transactions',
  'campaign-progress',
  'campaign-ledger',
  'saved-offers',
  'reviews',
  'follows',
] as const

export const portalCustomerSearchSchema = z.object({
  tab: z.enum(CUSTOMER_TABS).optional(),
  page: z.number().int().min(1).optional(),
})

export type PortalCustomerSearchParams = z.infer<typeof portalCustomerSearchSchema>

export const portalContentSearchSchema = z.object({
  key: z.string().max(80).optional(),
})

const contentSection = z.object({
  id: z.string().max(60).optional(),
  heading: z.string().max(180),
  body: z.string().trim().min(1, 'Section text is required').max(5000),
})

export const portalContentFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(180),
  summary: z.string().max(500),
  sections: z.array(contentSection).max(30),
  data: z.record(z.string(), z.unknown()),
  published: z.boolean(),
})

export type PortalContentFormValues = z.infer<typeof portalContentFormSchema>
