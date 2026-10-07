import type { PaginatedData } from '@/types/api'
import { apiGet } from '@/lib/api'

/** One recorded action. Append-only: there is no create, update or delete. */
export interface AuditLog {
  id: number
  action: string
  actorId: number | null
  actorEmail: string | null
  subjectType: string | null
  subjectId: string | null
  summary: string | null
  metadata: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
  actor?: {
    id: number
    fullname: string
    email: string
  } | null
}

export const getAuditLogs = (params?: {
  page?: number
  limit?: number
  search?: string
  sort?: string
  direction?: string
  action?: string
}) => apiGet<PaginatedData<AuditLog>>('/api/audit-logs', { params })

export const getAuditActions = () =>
  apiGet<Array<string>>('/api/audit-logs/actions')
