import {
  ModalBody,
  ModalContent,
  ModalHeader,
} from '@heroui/react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarClock,
  MapPin,
  Pencil,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import type { ReportFormValues } from '@/lib/schemas/reports'
import type { ReportStatus } from '@/types/api'
import { PageHeader } from '@/components/layout/page-header'
import { ReportForm } from '@/components/features/reports/components/report-form'
import {
  ClassificationStatusBadge,
  ConfidenceValue,
  ReportStatusBadge,
  WasteCategoryBadge,
} from '@/components/features/reports/components/report-badges'
import { Button, Modal } from '@/components/shared/controls'
import { useConfirmation } from '@/hooks/global/use-confirmation'
import { useAuth } from '@/hooks/auth/use-auth'
import { useUserPermission } from '@/hooks/permissions/use-permissions'
import {
  useReportDetail,
  useUpdateReportMutation,
} from '@/hooks/reports'
import {
  CLASSIFICATION_ERROR_LABEL,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TRANSITIONS,
} from '@/lib/constants/reports'
import { formatDateTime } from '@/lib/utils/format'

const routeApi = getRouteApi('/reports/$reportId')

export function ReportDetailPage() {
  const { reportId } = routeApi.useParams()
  const navigate = useNavigate()
  const id = Number(reportId)
  const detail = useReportDetail(id)
  const updateMutation = useUpdateReportMutation()
  const { hasPermission } = useUserPermission()
  const { user } = useAuth()
  const { confirm } = useConfirmation()
  const [editOpen, setEditOpen] = useState(false)
  const report = detail.report

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-56 animate-pulse rounded-large bg-default-200" />
        <div className="h-80 w-full animate-pulse rounded-large bg-default-100" />
      </div>
    )
  }

  if (detail.isError || !report) {
    return (
      <div className="rounded-large border border-danger-200 bg-danger-50 p-6 text-sm text-danger-700">
        Report could not be loaded or you do not have access to it.
      </div>
    )
  }

  const isOwner = report.reporterId === user?.sub
  const isPending = report.status === 'PENDING'
  const canEdit =
    hasPermission('reports.update.all') ||
    (hasPermission('reports.update.own') && isOwner && isPending)
  const canDelete =
    hasPermission('reports.delete.all') ||
    (hasPermission('reports.delete.own') && isOwner && isPending)
  const canChangeStatus = hasPermission('reports.status.update')
  const nextStatuses = REPORT_STATUS_TRANSITIONS[report.status]

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Report',
      message: `Delete report #${report.id}? This cannot be undone.`,
      color: 'danger',
    })
    if (confirmed)
      detail.deleteReport(report.id, {
        onSuccess: () => void navigate({ to: '/reports' }),
      })
  }

  const handleEdit = async (values: ReportFormValues, photo?: File) => {
    await updateMutation.mutateAsync({ id: report.id, values, photo })
    setEditOpen(false)
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title={`Report #${report.id}`}
        description={report.description}
        breadcrumbs={[
          { label: 'Reports', href: '/reports' },
          { label: `#${report.id}`, isCurrent: true },
        ]}
        leading={
          <Button
            isIconOnly
            variant="light"
            aria-label="Back to reports"
            onPress={() => void navigate({ to: '/reports' })}
          >
            <ArrowLeft size={18} />
          </Button>
        }
        actions={
          <>
            {canEdit && (
              <Button
                variant="bordered"
                startContent={<Pencil size={16} />}
                onPress={() => setEditOpen(true)}
              >
                Edit
              </Button>
            )}
            {canDelete && (
              <Button
                color="danger"
                variant="flat"
                startContent={<Trash2 size={16} />}
                onPress={() => void handleDelete()}
                isLoading={detail.isDeleting}
              >
                Delete
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="overflow-hidden rounded-large border border-default-200 bg-content1">
          {report.media?.url ? (
            <img
              src={report.media.url}
              alt="Report waste photo"
              className="max-h-[520px] w-full object-contain"
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-default-500">
              Photo unavailable
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-large border border-default-200 bg-content1 p-5">
            <h2 className="mb-4 text-lg font-semibold">Handling status</h2>
            <div className="flex flex-wrap items-center gap-3">
              <ReportStatusBadge status={report.status} />
              {canChangeStatus && nextStatuses.length > 0 && (
                <select
                  aria-label="Update report status"
                  className="app-field-control rounded-lg px-3 py-2 text-sm"
                  value=""
                  disabled={detail.isUpdatingStatus}
                  onChange={(event) => {
                    if (event.target.value)
                      detail.updateStatus(event.target.value as ReportStatus)
                  }}
                >
                  <option value="">Change status...</option>
                  {nextStatuses.map((status) => (
                    <option key={status} value={status}>
                      {REPORT_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {canChangeStatus && nextStatuses.length === 0 && (
              <p className="mt-3 text-sm text-default-500">
                This report is in a final status.
              </p>
            )}
          </section>

          <section className="rounded-large border border-default-200 bg-content1 p-5">
            <h2 className="mb-4 text-lg font-semibold">AI classification</h2>
            <div className="flex flex-wrap items-center gap-2">
              <WasteCategoryBadge category={report.predictedCategory} />
              <ClassificationStatusBadge status={report.classificationStatus} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-default-500">Confidence</dt>
                <dd className="font-medium">
                  <ConfidenceValue value={report.confidence} />
                </dd>
              </div>
              <div>
                <dt className="text-default-500">Model version</dt>
                <dd className="font-medium">{report.modelVersion || '—'}</dd>
              </div>
            </dl>
            {report.classificationStatus === 'FAILED' && (
              <p className="mt-4 rounded-large bg-warning-50 p-3 text-sm text-warning-700">
                {CLASSIFICATION_ERROR_LABEL[report.classificationError ?? ''] ||
                  'AI classification failed. No category or confidence was stored.'}
              </p>
            )}
          </section>

          <section className="rounded-large border border-default-200 bg-content1 p-5">
            <h2 className="mb-4 text-lg font-semibold">Details</h2>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-start gap-2">
                <UserRound size={16} className="mt-0.5 text-default-500" />
                <div>
                  <p className="font-medium">
                    {report.reporter?.fullname || 'Unknown reporter'}
                  </p>
                  <p className="text-default-500">{report.reporter?.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={16} className="mt-0.5 text-default-500" />
                <div>
                  <p className="font-medium">
                    {report.latitude !== null && report.longitude !== null
                      ? `${report.latitude}, ${report.longitude}`
                      : 'Location not provided'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarClock size={16} className="mt-0.5 text-default-500" />
                <div>
                  <p className="font-medium">
                    Created {formatDateTime(report.createdAt)}
                  </p>
                  <p className="text-default-500">
                    Updated {formatDateTime(report.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="mt-5 rounded-large border border-default-200 bg-content1 p-5">
        <h2 className="mb-2 text-lg font-semibold">Description</h2>
        <p className="whitespace-pre-wrap text-sm text-default-700">
          {report.description}
        </p>
      </section>

      <Modal
        isOpen={editOpen}
        onOpenChange={setEditOpen}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Edit Report #{report.id}</ModalHeader>
              <ModalBody className="pb-6">
                <ReportForm
                  mode="edit"
                  report={report}
                  isSubmitting={updateMutation.isPending}
                  onSubmit={handleEdit}
                  onCancel={onClose}
                />
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
