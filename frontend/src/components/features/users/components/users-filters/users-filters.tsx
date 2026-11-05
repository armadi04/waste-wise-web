import { CalendarRange, ShieldCheck, UserRound } from 'lucide-react'
import type { UserSearchParams } from '@/lib/schemas/users'
import {
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUS_VALUES,
} from '@/lib/constants/account-status'
import { FilterDropdown } from '@/components/features/users/components/users-filters/child/filter-dropdown'

import {
  DATE_OPTIONS,
  METHOD_OPTIONS,
} from '@/components/features/users/components/users-filters/lib/users-filters-helpers'

export function UsersFilters({
  value,
  onChange,
}: {
  value: UserSearchParams
  onChange: (
    filters: Pick<
      UserSearchParams,
      'createdIn' | 'registerMethod' | 'timeZone' | 'accountStatus'
    >,
  ) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm">
        Zona laporan
        <select
          aria-label="Zona laporan"
          className="app-field-control rounded-lg px-2 py-1"
          value={value.timeZone ?? 'Asia/Jakarta'}
          onChange={(event) =>
            onChange({
              timeZone: event.target.value as UserSearchParams['timeZone'],
            })
          }
        >
          <option value="Asia/Jakarta">WIB</option>
          <option value="Asia/Makassar">WITA</option>
          <option value="Asia/Jayapura">WIT</option>
        </select>
      </label>
      <FilterDropdown
        value={value.createdIn}
        options={DATE_OPTIONS}
        label="Filter waktu daftar"
        icon={<CalendarRange size={14} />}
        onChange={(createdIn) =>
          onChange({ createdIn: createdIn as UserSearchParams['createdIn'] })
        }
      />
      <label className="flex items-center gap-2 text-sm">
        <ShieldCheck size={14} className="text-default-500" />
        <span className="sr-only">Filter account status</span>
        <select
          aria-label="Filter account status"
          className="app-field-control rounded-lg px-2 py-1"
          value={value.accountStatus ?? ''}
          onChange={(event) =>
            onChange({
              accountStatus: (event.target.value || undefined) as
                | UserSearchParams['accountStatus']
                | undefined,
            })
          }
        >
          <option value="">All statuses</option>
          {ACCOUNT_STATUS_VALUES.map((status) => (
            <option key={status} value={status}>
              {ACCOUNT_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </label>
      <FilterDropdown
        value={value.registerMethod}
        options={METHOD_OPTIONS}
        label="Filter metode daftar"
        icon={<UserRound size={14} />}
        onChange={(registerMethod) =>
          onChange({
            registerMethod:
              registerMethod as UserSearchParams['registerMethod'],
          })
        }
      />
    </div>
  )
}
