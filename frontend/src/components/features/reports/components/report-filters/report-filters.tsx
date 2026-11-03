import type { ReportSearchParams } from '@/lib/schemas/reports'
import type { ReportStatus, User, WasteCategory } from '@/types/api'
import {
  REPORT_STATUS_LABEL,
  REPORT_STATUS_VALUES,
  WASTE_CATEGORY_LABEL,
  WASTE_CATEGORY_VALUES,
} from '@/lib/constants/reports'

interface ReportFiltersProps {
  value: ReportSearchParams
  onChange: (filters: Partial<ReportSearchParams>) => void
  reporters?: Array<User>
  showReporter?: boolean
}

export function ReportFilters({
  value,
  onChange,
  reporters = [],
  showReporter = false,
}: ReportFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-default-500">Status</span>
        <select
          aria-label="Filter status"
          className="app-field-control rounded-lg px-2 py-1"
          value={value.status ?? ''}
          onChange={(event) =>
            onChange({
              status: (event.target.value || undefined) as
                | ReportStatus
                | undefined,
            })
          }
        >
          <option value="">All</option>
          {REPORT_STATUS_VALUES.map((status) => (
            <option key={status} value={status}>
              {REPORT_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-default-500">Category</span>
        <select
          aria-label="Filter waste category"
          className="app-field-control rounded-lg px-2 py-1"
          value={value.category ?? ''}
          onChange={(event) =>
            onChange({
              category: (event.target.value || undefined) as
                | WasteCategory
                | undefined,
            })
          }
        >
          <option value="">All</option>
          {WASTE_CATEGORY_VALUES.map((category) => (
            <option key={category} value={category}>
              {WASTE_CATEGORY_LABEL[category]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-default-500">From</span>
        <input
          type="date"
          aria-label="Filter reports from date"
          className="app-field-control rounded-lg px-2 py-1"
          value={value.from?.slice(0, 10) ?? ''}
          onChange={(event) =>
            onChange({ from: event.target.value || undefined })
          }
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-default-500">To</span>
        <input
          type="date"
          aria-label="Filter reports to date"
          className="app-field-control rounded-lg px-2 py-1"
          value={value.to?.slice(0, 10) ?? ''}
          onChange={(event) =>
            onChange({ to: event.target.value || undefined })
          }
        />
      </label>

      {showReporter && (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-default-500">Reporter</span>
          <select
            aria-label="Filter reporter"
            className="app-field-control rounded-lg px-2 py-1"
            value={value.reporterId ?? ''}
            onChange={(event) =>
              onChange({
                reporterId: event.target.value
                  ? Number(event.target.value)
                  : undefined,
              })
            }
          >
            <option value="">All</option>
            {reporters.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullname || user.email}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
