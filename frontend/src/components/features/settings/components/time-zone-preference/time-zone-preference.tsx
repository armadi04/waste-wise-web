import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/auth'
import {
  timeZonePreferenceOptions,
  updateTimeZonePreference,
} from '@/lib/services/time-zone.service'
import { BUSINESS_TIME_ZONES, timeZoneLabel } from '@/lib/utils/business-time'

export function TimeZonePreference() {
  const identity = useAuth().user?.sub
  const client = useQueryClient()
  const query = useQuery(timeZonePreferenceOptions(identity))
  const mutation = useMutation({
    mutationFn: updateTimeZonePreference,
    onSuccess: (data) =>
      client.setQueryData(timeZonePreferenceOptions(identity).queryKey, data),
  })
  return (
    <section className="rounded-xl border border-default-200 p-4">
      <label className="block font-semibold" htmlFor="display-timezone">
        Zona waktu tampilan
      </label>
      <select
        id="display-timezone"
        className="mt-3 w-full rounded-lg border border-default-300 bg-default-50 p-3"
        disabled={!query.data || mutation.isPending}
        value={query.data?.timeZone ?? ''}
        onChange={(event) =>
          mutation.mutate({ timeZone: event.target.value || null })
        }
      >
        <option value="">Otomatis — mengikuti perangkat</option>
        {BUSINESS_TIME_ZONES.map((zone) => (
          <option key={zone} value={zone}>
            {timeZoneLabel(zone)} — {zone}
          </option>
        ))}
        {query.data?.timeZone &&
          !(BUSINESS_TIME_ZONES as ReadonlyArray<string>).includes(
            query.data.timeZone,
          ) && (
            <option value={query.data.timeZone}>{query.data.timeZone}</option>
          )}
      </select>
      <p className="mt-2 text-sm">
        Mengatur zona waktu tampilan akun. Laporan tetap mengikuti zona
        bisnis.
      </p>
      {(query.isError || mutation.isError) && (
        <p role="alert" className="mt-2 text-sm text-red-500">
          Preferensi gagal dimuat atau disimpan. Coba lagi.
        </p>
      )}
    </section>
  )
}
