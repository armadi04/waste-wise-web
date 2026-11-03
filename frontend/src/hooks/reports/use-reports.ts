import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { createElement } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Report, ReportStatus } from '@/types/api'
import type {
  CreateReportFormValues,
  EditReportFormValues,
  ReportFormValues,
} from '@/lib/schemas/reports'
import { addToast } from '@/components/shared/controls/toast'
import { ReportFilters } from '@/components/features/reports/components/report-filters'
import { getColumns } from '@/components/features/reports/components/table-columns'
import { useConfirmation } from '@/hooks/global/use-confirmation'
import { useDataTable } from '@/hooks/global/use-data-table'
import { useAppMutation } from '@/hooks/global/use-mutations'
import { useAuth } from '@/hooks/auth/use-auth'
import { useUserPermission } from '@/hooks/permissions/use-permissions'
import { useAllUsers } from '@/hooks/users/use-users'
import {
  reportQueryOptions,
  reportStatsQueryOptions,
  reportsQueryOptions,
} from '@/lib/query/options'
import {
  createReport,
  deleteReport,
  updateReport,
  updateReportStatus,
} from '@/lib/services/report.service'
import { uploadMedia } from '@/lib/services/media.service'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useReportsUiStore } from '@/lib/stores/reports-ui.store'

const routeApi = getRouteApi('/reports/')

export const useReports = () => {
  const searchParams = routeApi.useSearch()
  return useQuery({
    ...reportsQueryOptions(searchParams),
    enabled: useAuthStore((state) =>
      Boolean(
        state.user?.permissions.includes('reports.read.own') ||
          state.user?.permissions.includes('reports.read.all'),
      ),
    ),
  })
}

export const useReport = (id: number) =>
  useQuery(reportQueryOptions(id))

export const useReportStats = (enabled = true) =>
  useQuery(reportStatsQueryOptions(enabled))

const notifyClassification = (report: Report) => {
  if (report.classificationStatus !== 'FAILED') return
  addToast({
    title: 'AI classification failed',
    description:
      report.classificationError ||
      'Report saved, but no category or confidence was stored.',
    color: 'warning',
  })
}

export const useCreateReportMutation = () =>
  useAppMutation({
    mutationFn: async ({
      values,
      photo,
    }: {
      values: ReportFormValues
      photo: File
    }) => {
      const media = await uploadMedia(photo)
      const report = await createReport({
        description: values.description,
        latitude: values.latitude,
        longitude: values.longitude,
        mediaId: media.id,
      })
      notifyClassification(report)
      return report
    },
    invalidateKeys: [['reports'], ['stats', 'reports'], ['media']],
    successMessage: 'Report created',
  })

export const useUpdateReportMutation = () =>
  useAppMutation({
    mutationFn: async ({
      id,
      values,
      photo,
    }: {
      id: number
      values: ReportFormValues
      photo?: File
    }) => {
      const mediaId = photo ? (await uploadMedia(photo)).id : undefined
      const report = await updateReport(id, {
        description: values.description,
        latitude: values.latitude,
        longitude: values.longitude,
        mediaId,
      })
      notifyClassification(report)
      return report
    },
    invalidateKeys: [['reports'], ['stats', 'reports'], ['media']],
    successMessage: 'Report updated',
  })

export const useDeleteReportMutation = () =>
  useAppMutation({
    mutationFn: deleteReport,
    invalidateKeys: [['reports'], ['stats', 'reports']],
    successMessage: 'Report deleted',
  })

export const useReportPage = () => {
  const tableState = useDataTable(routeApi)
  const searchParams = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { data, isLoading } = useReports()
  const { hasPermission } = useUserPermission()
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const showReporter = hasPermission('reports.read.all')
  const { data: reporters = [] } = useAllUsers(
    showReporter && hasPermission('users.read'),
  )
  const deleteMutation = useDeleteReportMutation()

  const openReport = (report: Report) =>
    void navigate({
      to: '/reports/$reportId',
      params: { reportId: String(report.id) },
    })

  const handleDelete = async (report: Report) => {
    const confirmed = await confirm({
      title: 'Delete Report',
      message: `Delete report #${report.id}? This cannot be undone.`,
      color: 'danger',
    })
    if (confirmed) deleteMutation.mutate(report.id)
  }

  const columns = getColumns({
    onView: openReport,
    onEdit: openReport,
    onDelete: handleDelete,
    hasPermission,
    currentUserId: user?.sub,
    showReporter,
  })

  return {
    tableProps: {
      data,
      columns,
      isLoading,
      onCreate: hasPermission('reports.create')
        ? () => void navigate({ to: '/reports/new' })
        : undefined,
      createLabel: 'New Report',
      searchPlaceholder: 'Search reports...',
      emptyContent: 'No reports found.',
      enableSelection: false,
      showExport: false,
      ...tableState,
      initialSearch: tableState.search,
      pendingRowId: deleteMutation.variables,
      headerActions: createElement(ReportFilters, {
        value: searchParams,
        showReporter,
        reporters,
        onChange: (filters) => {
          void navigate({
            search: (prev) => ({ ...prev, ...filters, page: 1 }),
          })
        },
      }),
    },
  }
}

export const useReportDetail = (id: number) => {
  const query = useReport(id)
  const navigate = routeApi.useNavigate()
  const statusMutation = useAppMutation({
    mutationFn: (status: ReportStatus) => updateReportStatus(id, status),
    invalidateKeys: [['reports'], ['stats', 'reports']],
    successMessage: 'Report status updated',
  })
  const deleteMutation = useDeleteReportMutation()

  return {
    report: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    updateStatus: statusMutation.mutate,
    isUpdatingStatus: statusMutation.isPending,
    deleteReport: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    goBack: () => void navigate({ to: '/reports' }),
  }
}

export const useReportsUi = () =>
  useReportsUiStore(
    useShallow((state) => ({
      editOpen: state.modals.edit.isOpen,
      editReport: state.modals.edit.entity,
      openEdit: (report: Report) => state.open('edit', report),
      closeEdit: () => state.close('edit'),
      onEditOpenChange: state.onOpenChange('edit'),
    })),
  )

export type { CreateReportFormValues, EditReportFormValues }
