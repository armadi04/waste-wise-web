import type { PermissionFormData } from '@/lib/schemas/permissions'
import type { Permission } from '@/types/auth'

export interface PermissionFormModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  editingPermission: Permission | null
  onSubmit: (data: PermissionFormData) => void
  isLoading?: boolean
  isReadOnly?: boolean
}
