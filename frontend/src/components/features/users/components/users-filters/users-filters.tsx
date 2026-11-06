import { CalendarRange, UserRound } from 'lucide-react'
import type { UserSearchParams } from '@/lib/schemas/users'
import {
  ACCOUNT_STATUS_LABEL,
  ACCOUNT_STATUS_VALUES,
} from '@/lib/constants/account-status'
import { AdvancedFilter } from '@/components/shared/advanced-filter'
import { FilterField } from '@/components/shared/controls'
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
  const activeCount = [
    value.createdIn,
    value.registerMethod,
    value.accountStatus,
  ].filter(Boolean).length

  return (
    <AdvancedFilter
      activeCount={activeCount}
      onReset={() =>
        onChange({
          createdIn: undefined,
          registerMethod: undefined,
          accountStatus: undefined,
        })
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <FilterField label="Zona laporan">
          <select
            aria-label="Zona laporan"
            className="app-field-control w-full rounded-lg px-2 py-1"
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
        </FilterField>
        <FilterDropdown
          value={value.createdIn}
          options={DATE_OPTIONS}
          title="Waktu daftar"
          label="Filter waktu daftar"
          icon={<CalendarRange size={14} />}
          onChange={(createdIn) =>
            onChange({ createdIn: createdIn as UserSearchParams['createdIn'] })
          }
        />
        <FilterField label="Status akun">
          <select
            aria-label="Filter account status"
            className="app-field-control w-full rounded-lg px-2 py-1"
            value={value.accountStatus ?? ''}
            onChange={(event) =>
              onChange({
                accountStatus: (event.target.value || undefined) as
                  UserSearchParams['accountStatus'] | undefined,
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
        </FilterField>
        <FilterDropdown
          value={value.registerMethod}
          title="Metode daftar"
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
    </AdvancedFilter>
  )
}
