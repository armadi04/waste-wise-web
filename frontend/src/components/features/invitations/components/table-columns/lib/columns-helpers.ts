import type { InvitationStatus } from '@/components/features/invitations/components/table-columns/types'
import type { Invitation } from '@/types/api'

export const getInvitationStatus = (item: Invitation): InvitationStatus => {
  if (item.acceptedAt) return 'accepted'
  if (new Date(item.expiresAt) < new Date()) return 'expired'
  return 'pending'
}

export const STATUS_META: Record<
  InvitationStatus,
  { label: string; color: 'success' | 'warning' | 'default' }
> = {
  pending: { label: 'Pending', color: 'warning' },
  accepted: { label: 'Accepted', color: 'success' },
  expired: { label: 'Expired', color: 'default' },
}
