import { Eye, Pencil, Trash2 } from 'lucide-react'
import {
  ConfidenceValue,
  ReportStatusBadge,
  WasteCategoryBadge,
} from '../report-badges'
import type { Report } from '@/types/api'
import type { Column } from '@/components/shared/datatable'
import type { GetReportColumnsParams } from './types'
import { ActionMenu } from '@/components/shared/action-menu'
import { formatDateTime } from '@/lib/utils/format'

export function getColumns({
  onView,
  onEdit,
  onDelete,
  hasPermission,
  currentUserId,
  showReporter,
}: GetReportColumnsParams): Array<Column<Report>> {
  const canManage = (report: Report) =>
    hasPermission('reports.update.all') ||
    (hasPermission('reports.update.own') &&
      report.reporterId === currentUserId &&
      report.status === 'PENDING')
  const canDelete = (report: Report) =>
    hasPermission('reports.delete.all') ||
    (hasPermission('reports.delete.own') &&
      report.reporterId === currentUserId &&
      report.status === 'PENDING')

  const columns: Array<Column<Report>> = [
    {
      name: 'ID',
      uid: 'id',
      sortable: true,
      render: (report) => <span className="tabular-nums">#{report.id}</span>,
      exportValue: (report) => report.id,
    },
    {
      name: 'Description',
      uid: 'description',
      sortable: true,
      truncate: true,
      maxWidth: 280,
    },
  ]

  if (showReporter) {
    columns.push({
      name: 'Reporter',
      uid: 'reporter',
      render: (report) => (
        <div className="flex flex-col">
          <span className="truncate">{report.reporter?.fullname || '—'}</span>
          <span className="text-xs text-default-500">
            {report.reporter?.email}
          </span>
        </div>
      ),
      exportValue: (report) =>
        report.reporter?.fullname || report.reporter?.email || '',
    })
  }

  columns.push(
    {
      name: 'Category',
      uid: 'predictedCategory',
      sortable: true,
      render: (report) => (
        <WasteCategoryBadge category={report.predictedCategory} />
      ),
      exportValue: (report) => report.predictedCategory ?? 'Not classified',
    },
    {
      name: 'Confidence',
      uid: 'confidence',
      sortable: true,
      align: 'end',
      render: (report) => <ConfidenceValue value={report.confidence} />,
      exportValue: (report) =>
        report.confidence === null
          ? ''
          : `${(report.confidence * 100).toFixed(1)}%`,
    },
    {
      name: 'Status',
      uid: 'status',
      sortable: true,
      render: (report) => <ReportStatusBadge status={report.status} />,
      exportValue: (report) => report.status,
    },
    {
      name: 'Created At',
      uid: 'createdAt',
      sortable: true,
      render: (report) => formatDateTime(report.createdAt),
      exportValue: (report) => report.createdAt,
    },
    {
      name: 'Actions',
      uid: 'actions',
      render: (report) => (
        <ActionMenu
          actions={[
            {
              key: 'view',
              label: 'View',
              icon: <Eye size={16} />,
              onPress: () => onView(report),
            },
            {
              key: 'edit',
              label: 'Edit',
              icon: <Pencil size={16} />,
              show: canManage(report),
              onPress: () => onEdit(report),
            },
            {
              key: 'delete',
              label: 'Delete',
              icon: <Trash2 size={16} />,
              danger: true,
              show: canDelete(report),
              onPress: () => onDelete(report),
            },
          ]}
        />
      ),
    },
  )

  return columns
}
