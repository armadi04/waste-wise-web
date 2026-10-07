import type { UserSession } from '@/lib/services/session.service'

export interface GetColumnsParams {
  onRevoke: (session: UserSession) => void
  hasPermission: (permission: string) => boolean
}
