import { useQuery } from '@tanstack/react-query'
import type { PortalField } from '@/components/features/portal/lib/config'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { portalLookupQueryOptions } from '@/lib/query/options'

/** Select bound to the `name` of an active curated record (category, city). */
export function LookupSelect({
  field,
  registration,
  current,
}: {
  field: PortalField
  registration: UseFormRegisterReturn
  current: string
}) {
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery(portalLookupQueryOptions(field.lookup!))
  const names = data
    .filter((item) => item.active !== false)
    .map((item) => String(item.name))
  const options =
    current && !names.includes(current) ? [current, ...names] : names
  return (
    <label className="block text-sm">
      {field.label}
      <select
        {...registration}
        required={field.required}
        disabled={isLoading}
        className="mt-2 w-full rounded-lg border border-default-300 bg-default-50 p-3"
      >
        <option value="">{isLoading ? 'Loading…' : 'Choose…'}</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
            {!names.includes(name) ? ' (inactive or unknown)' : ''}
          </option>
        ))}
      </select>
      {isError && (
        <span className="mt-1 block text-xs text-danger">
          Options could not be loaded.
        </span>
      )}
      {!isLoading && !isError && !names.length && (
        <span className="mt-1 block text-xs text-default-500">
          No active options yet. Add them under Portal →{' '}
          {field.label === 'City' ? 'Cities' : 'Categories'}.
        </span>
      )}
    </label>
  )
}
