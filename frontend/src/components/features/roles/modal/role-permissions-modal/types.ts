import type { Permission, Role } from '@/types/auth'

export interface RolePermissionsModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  role: Role | null
  allPermissions: Array<Permission>
  isLoading?: boolean
  onSave: (roleId: number, permissionIds: Array<number>) => void
}
