import type { UserProfile } from '@/types/auth'

export interface GetColumnsParams {
  onView: (user: UserProfile) => void
  onEdit: (user: UserProfile) => void
  onDelete: (id: number) => void
  onToggleActive: (user: UserProfile) => void
  onManageRoles: (user: UserProfile) => void
  onManagePermissions: (user: UserProfile) => void
  onResetPassword: (user: UserProfile) => void
  onImpersonate: (user: UserProfile) => void
  hasPermission: (permission: string) => boolean
  /** The signed-in user's id — you can't sign in as yourself. */
  currentUserId?: number
}
