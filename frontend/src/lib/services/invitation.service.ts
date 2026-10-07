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
  return apiGet<PaginatedData<Invitation> | Array<Invitation>>('/invitations', {
    params,
  })
}

export const createInvitation = (data: CreateInvitationData) => {
  return apiPost<CreateInvitationResponse>('/invitations', data)
}

export const resendInvitation = (id: number) => {
  return apiPost<Invitation>(`/invitations/${id}/resend`, {})
}

export const revokeInvitation = (id: number) => {
  return apiDelete<void>(`/invitations/${id}`)
}

export const bulkRevokeInvitations = (ids: Array<number>) => {
  return apiPost<{ deleted: number }>('/invitations/bulk-delete', { ids })
}
