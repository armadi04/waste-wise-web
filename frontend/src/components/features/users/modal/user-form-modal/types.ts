import type { UserFormData } from '@/lib/schemas/users'
import type { UserProfile } from '@/types/auth'

export interface UserFormModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  editingUser: UserProfile | null
  onSubmit: (data: UserFormData) => void
  isLoading?: boolean
  isReadOnly?: boolean
}
