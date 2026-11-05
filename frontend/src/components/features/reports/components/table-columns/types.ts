import type { Report } from '@/types/api'

export interface GetReportColumnsParams {
  onView: (report: Report) => void
  onEdit: (report: Report) => void
  onDelete: (report: Report) => void
  hasPermission: (permission: string) => boolean
  currentUserId?: number
  showReporter: boolean
}
