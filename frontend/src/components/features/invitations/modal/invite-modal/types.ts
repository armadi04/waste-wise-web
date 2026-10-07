import type { Role } from '@/types/api'

export interface InviteModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  allRoles: Array<Role>
  isLoading?: boolean
  inviteUrl: string | null
  onGenerate: (data: { email: string; roleIds: Array<number> }) => void
  onReset: () => void
}
