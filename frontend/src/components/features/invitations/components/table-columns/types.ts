import type { Invitation, Role } from '@/types/api'

export type InvitationStatus = 'pending' | 'accepted' | 'expired'

export interface GetColumnsParams {
  roles: Array<Role>
  onCopyLink: (item: Invitation) => void
  onResend: (item: Invitation) => void
  onRevoke: (id: number) => void
  hasPermission: (permission: string) => boolean
}
