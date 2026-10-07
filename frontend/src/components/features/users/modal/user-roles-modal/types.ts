import type { Role, UserProfile } from '@/types/auth'

export interface UserRolesModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  user: UserProfile | null
  allRoles: Array<Role>
  isLoading?: boolean
  onSave: (userId: number, roleIds: Array<number>) => void
}
