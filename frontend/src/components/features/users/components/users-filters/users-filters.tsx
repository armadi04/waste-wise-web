import { CalendarRange, UserRound } from 'lucide-react'
import type { UserSearchParams } from '@/lib/schemas/users'
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
      'createdIn' | 'registerMethod' | 'timeZone'
    >,
  ) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm">
        Zona laporan
        <select
          aria-label="Zona laporan"
          className="rounded-lg border border-default-200 bg-default-50 px-2 py-1"
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
