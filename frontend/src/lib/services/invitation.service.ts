import type { Invitation, PaginatedData } from '@/types/api'
import { apiDelete, apiGet, apiPost } from '@/lib/api'

export interface CreateInvitationData {
  email: string
  roleIds?: Array<number>
}

export interface CreateInvitationResponse {
  invitation: Invitation
  inviteUrl: string
}

export const getInvitations = (params?: {
  page?: number
  limit?: number
  search?: string
  sort?: string
  direction?: string
  paginated?: boolean
}) => {
  return apiGet<PaginatedData<Invitation> | Array<Invitation>>(
    '/api/invitations',
    { params },
  )
}

export const createInvitation = (data: CreateInvitationData) => {
  return apiPost<CreateInvitationResponse>('/api/invitations', data)
}

export const resendInvitation = (id: number) => {
  return apiPost<Invitation>(`/api/invitations/${id}/resend`, {})
}

export const revokeInvitation = (id: number) => {
  return apiDelete<void>(`/api/invitations/${id}`)
}

export const bulkRevokeInvitations = (ids: Array<number>) => {
  return apiPost<{ deleted: number }>('/api/invitations/bulk-delete', { ids })
}
