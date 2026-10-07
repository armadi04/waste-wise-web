import type { RoleFormData } from '@/lib/schemas/roles'
import type { Role } from '@/types/auth'

export interface RoleFormModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  editingRole: Role | null
  onSubmit: (data: RoleFormData) => void
  isLoading?: boolean
  isReadOnly?: boolean
}
