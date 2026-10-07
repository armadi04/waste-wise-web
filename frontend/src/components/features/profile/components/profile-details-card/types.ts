import type { UserProfile } from '@/types/auth'

export interface ProfileDetailsCardProps {
  profile: UserProfile | undefined
  isLoading: boolean
  activeRole?: string
}
