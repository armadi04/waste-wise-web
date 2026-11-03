import type {
  ClassificationStatus,
  ReportStatus,
  WasteCategory,
} from '@/types/api'
import { Chip } from '@/components/shared/controls'
import {
  CLASSIFICATION_STATUS_LABEL,
  REPORT_STATUS_COLOR,
  REPORT_STATUS_LABEL,
  WASTE_CATEGORY_COLOR,
  WASTE_CATEGORY_LABEL,
} from '@/lib/constants/reports'

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <Chip
      size="sm"
      variant="flat"
      color={REPORT_STATUS_COLOR[status]}
      aria-label={`Status: ${REPORT_STATUS_LABEL[status]}`}
    >
      {REPORT_STATUS_LABEL[status]}
    </Chip>
  )
}

export function WasteCategoryBadge({
  category,
}: {
  category: WasteCategory | null
}) {
  if (!category)
    return (
      <Chip size="sm" variant="flat" color="default">
        Not classified
      </Chip>
    )
  return (
    <Chip
      size="sm"
      variant="flat"
      color={WASTE_CATEGORY_COLOR[category]}
      aria-label={`Category: ${WASTE_CATEGORY_LABEL[category]}`}
    >
      {WASTE_CATEGORY_LABEL[category]}
    </Chip>
  )
}

export function ClassificationStatusBadge({
  status,
}: {
  status: ClassificationStatus
}) {
  return (
    <Chip
      size="sm"
      variant="flat"
      color={status === 'COMPLETED' ? 'success' : 'danger'}
    >
      {CLASSIFICATION_STATUS_LABEL[status]}
    </Chip>
  )
}

export function ConfidenceValue({ value }: { value: number | null }) {
  if (value === null) return <span className="text-default-500">—</span>
  return (
    <span className="tabular-nums">{(value * 100).toFixed(1)}%</span>
  )
}
