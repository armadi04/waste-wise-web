import type { UserProfile } from '@/types/auth'

export interface ResetPasswordModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  user: UserProfile | null
  onSubmit: (userId: number, password: string) => void
  isLoading?: boolean
}
