import type { Permission, UserProfile } from '@/types/auth'

export interface UserPermissionsModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  user: UserProfile | null
  allPermissions: Array<Permission>
  isLoading?: boolean
  onSave: (userId: number, permissionIds: Array<number>) => void
}
