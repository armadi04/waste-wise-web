import type { UserProfile } from '@/types/auth'

export interface ProfileDrawerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  user: UserProfile | null
}
