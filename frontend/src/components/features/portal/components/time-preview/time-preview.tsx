import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { previewLocalTime } from '@/lib/services/time-zone.service'
import { isLocalDateTime } from '@/lib/utils/business-time'

export function TimePreview({
  value,
  timeZone,
}: {
  value: string
  timeZone: string
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setLocal(value), 300)
    return () => clearTimeout(timer)
  }, [value])
  const query = useQuery({
    queryKey: ['time-preview', local, timeZone],
    queryFn: () => previewLocalTime(local, timeZone),
    enabled: isLocalDateTime(local),
    retry: false,
    staleTime: 60_000,
  })
  if (!value) return null
  return (
    <p role="status" className="mt-1 break-all text-xs text-default-500">
      {query.isError
        ? 'Preview gagal. Periksa waktu dan coba lagi.'
        : query.data && local === value
          ? `UTC: ${query.data.instant}`
          : 'Menghitung waktu UTC…'}
    </p>
  )
}
