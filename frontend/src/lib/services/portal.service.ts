import type { PaginatedData } from '@/types/api'
import type { components } from '@/types/api.generated'
import type { PortalDashboard, PortalRecord, PortalResource, PortalValue } from '@/types/portal'
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api'

export interface PortalListParams {
  page?: number
  limit?: number
  search?: string
  sort?: string
  direction?: string
  paginated?: boolean
  userId?: number
}

const basePath = (resource: PortalResource) => `/api/portal/admin/${resource}`

export const getPortalDashboard = () =>
  apiGet<PortalDashboard>('/api/portal/admin/dashboard')

export const getPortalRecords = (
  resource: PortalResource,
  params?: PortalListParams,
) => apiGet<PaginatedData<PortalRecord> | Array<PortalRecord>>(basePath(resource), { params })

export const getPortalRecord = (resource: PortalResource, id: number) =>
  apiGet<PortalRecord>(`${basePath(resource)}/${id}`)

export const createPortalRecord = (resource: PortalResource, data: Record<string, PortalValue>) =>
  apiPost<PortalRecord>(basePath(resource), data)

export const updatePortalRecord = (
  resource: PortalResource,
  id: number,
  data: Record<string, PortalValue>,
) => apiPatch<PortalRecord>(`${basePath(resource)}/${id}`, data)

export const deletePortalRecord = (resource: PortalResource, id: number) =>
  apiDelete<void>(`${basePath(resource)}/${id}`)

export const bulkDeletePortalRecords = (resource: PortalResource, ids: Array<number>) =>
  apiPost<{ deleted: number }>(`${basePath(resource)}/bulk-delete`, { ids })

export const getPortalEventTickets = (eventId: number) =>
  apiGet<Array<PortalRecord>>(`/api/portal/admin/events/${eventId}/tickets`)

export const createPortalEventTicket = (
  eventId: number,
  data: Record<string, PortalValue>,
) => apiPost<PortalRecord>(`/api/portal/admin/events/${eventId}/tickets`, data)

export const updatePortalEventTicket = (
  id: number,
  data: Record<string, PortalValue>,
) => apiPatch<PortalRecord>(`/api/portal/admin/event-tickets/${id}`, data)

export const deletePortalEventTicket = (id: number) =>
  apiDelete<void>(`/api/portal/admin/event-tickets/${id}`)

export const getPortalOrderItems = (orderId: number) =>
  apiGet<Array<PortalRecord>>(`/api/portal/admin/orders/${orderId}/items`)

export const createPortalOrderItem = (
  orderId: number,
  data: Record<string, PortalValue>,
) => apiPost<PortalRecord>(`/api/portal/admin/orders/${orderId}/items`, data)

export const updatePortalOrderItem = (
  id: number,
  data: Record<string, PortalValue>,
) => apiPatch<PortalRecord>(`/api/portal/admin/order-items/${id}`, data)

export const deletePortalOrderItem = (id: number) =>
  apiDelete<void>(`/api/portal/admin/order-items/${id}`)

export const approvePortalRefund = (id: number) =>
  apiPost<components['schemas']['PortalOrderResponseDto']>(
    `/api/portal/admin/orders/${id}/refund-approve`,
    {},
  )

export const rejectPortalRefund = (id: number, reason: string) =>
  apiPost<components['schemas']['PortalOrderResponseDto']>(`/api/portal/admin/orders/${id}/refund-reject`, { reason })

export type PassKind = 'voucher' | 'ticket'
export type PassVerification = components['schemas']['VerifyCampaignUsageResponseDto']

export const verifyPortalPass = (kind: PassKind, id: number) =>
  apiPost<PassVerification>(
    kind === 'voucher'
      ? `/api/portal/admin/vouchers/${id}/redeem`
      : `/api/portal/admin/tickets/${id}/check-in`,
    {},
  )

export const scanPortalPass = (kind: PassKind, token: string) =>
  apiPost<PassVerification>(`/api/portal/admin/${kind}s/scan`, { token })

export interface CampaignAdjustmentInput {
  userId: number
  campaignId: number
  points: number
  reason: string
  idempotencyKey: string
}

export const adjustPortalCampaignPoints = (data: CampaignAdjustmentInput) =>
  apiPost<components['schemas']['CampaignAdjustmentResponseDto']>(
    '/api/portal/admin/campaign-progress/adjustments',
    data,
  )

export type PortalCustomerSummary = components['schemas']['PortalCustomerSummaryDto']

export const getPortalCustomer = (id: number) =>
  apiGet<PortalCustomerSummary>(`/api/portal/admin/customers/${id}`)

export const revokePortalGift = (id: number, reason: string) =>
  apiPost<PortalRecord>(`/api/portal/admin/gifts/${id}/revoke`, { reason })

export interface WalletAdjustmentInput {
  userId: number
  amount: number
  reason: string
  idempotencyKey: string
}

export const adjustPortalWallet = (data: WalletAdjustmentInput) =>
  apiPost<components['schemas']['PortalWalletAdjustmentResponseDto']>(
    '/api/portal/admin/wallets/adjustments',
    data,
  )

export type PortalContent = components['schemas']['PortalAdminContentDto']
export type SavePortalContentInput = components['schemas']['SavePortalContentDto']

export const getPortalContentList = () =>
  apiGet<Array<PortalContent>>('/api/portal/admin/content')

export const savePortalContent = (key: string, data: SavePortalContentInput) =>
  apiPut<PortalContent>(`/api/portal/admin/content/${encodeURIComponent(key)}`, data)
