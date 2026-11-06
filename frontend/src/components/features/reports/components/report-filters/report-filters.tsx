import type { ReportSearchParams } from '@/lib/schemas/reports'
import type { CategoryFilter, ReportStatus, User } from '@/types/api'
import { AdvancedFilter } from '@/components/shared/advanced-filter'
import { FilterField } from '@/components/shared/controls'
import {
  CATEGORY_FILTER_LABEL,
  CATEGORY_FILTER_VALUES,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_VALUES,
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
  const activeCount = [
    value.status,
    value.category,
    value.from,
    value.to,
    showReporter ? value.reporterId : undefined,
  ].filter((filter) => filter !== undefined && filter !== '').length

  return (
    <AdvancedFilter
      activeCount={activeCount}
      onReset={() =>
        onChange({
          status: undefined,
          category: undefined,
          from: undefined,
          to: undefined,
          reporterId: undefined,
        })
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <FilterField label="Status">
          <select
            aria-label="Filter status"
            className="app-field-control w-full rounded-lg px-2 py-1"
            value={value.status ?? ''}
            onChange={(event) =>
              onChange({
                status: (event.target.value || undefined) as
                  ReportStatus | undefined,
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
        </FilterField>

        <FilterField label="Category">
          <select
            aria-label="Filter waste category"
            className="app-field-control w-full rounded-lg px-2 py-1"
            value={value.category ?? ''}
            onChange={(event) =>
              onChange({
                category: (event.target.value || undefined) as
                  CategoryFilter | undefined,
              })
            }
          >
            <option value="">All</option>
            {CATEGORY_FILTER_VALUES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_FILTER_LABEL[category]}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="From">
          <input
            type="date"
            aria-label="Filter reports from date"
            className="app-field-control w-full rounded-lg px-2 py-1"
            value={value.from?.slice(0, 10) ?? ''}
            onChange={(event) =>
              onChange({ from: event.target.value || undefined })
            }
          />
        </FilterField>

        <FilterField label="To">
          <input
            type="date"
            aria-label="Filter reports to date"
            className="app-field-control w-full rounded-lg px-2 py-1"
            value={value.to?.slice(0, 10) ?? ''}
            onChange={(event) =>
              onChange({ to: event.target.value || undefined })
            }
          />
        </FilterField>

        {showReporter && (
          <FilterField label="Reporter" className="col-span-2">
            <select
              aria-label="Filter reporter"
              className="app-field-control w-full rounded-lg px-2 py-1"
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
          </FilterField>
        )}
      </div>
    </AdvancedFilter>
  )
}
