import type {
  PaginatedData,
  Report,
  ReportStats,
  ReportStatus,
} from '@/types/api'
import type { ReportSearchParams } from '@/lib/schemas/reports'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api'

export interface CreateReportData {
  description: string
  mediaId: number
  latitude?: number
  longitude?: number
}

export interface UpdateReportData {
  description?: string
  mediaId?: number
  latitude?: number
  longitude?: number
}

export const getReports = (params: ReportSearchParams) =>
  apiGet<PaginatedData<Report>>('/reports', {
    params: {
      page: params.page || 1,
      limit: params.limit || 20,
      search: params.search || undefined,
      status: params.status,
      category: params.category,
      from: params.from || undefined,
      to: params.to || undefined,
      reporterId: params.reporterId,
      sort: params.sort || 'createdAt',
      direction: params.direction || 'desc',
      paginated: true,
    },
  })

export const getReport = (id: number) => apiGet<Report>(`/reports/${id}`)

export const createReport = (data: CreateReportData) =>
  apiPost<Report>('/reports', data)

export const updateReport = (id: number, data: UpdateReportData) =>
  apiPatch<Report>(`/reports/${id}`, data)

export const deleteReport = (id: number) =>
  apiDelete<{ deleted: boolean }>(`/reports/${id}`)

export const updateReportStatus = (id: number, status: ReportStatus) =>
  apiPatch<Report>(`/reports/${id}/status`, { status })

export const getReportStats = () => apiGet<ReportStats>('/stats/reports')
