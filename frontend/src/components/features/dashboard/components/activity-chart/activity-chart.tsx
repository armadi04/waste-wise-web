import { Card, Skeleton } from '@heroui/react'
import { Suspense, lazy } from 'react'

const ActivityChartGraph = lazy(
  () =>
    import('@/components/features/dashboard/components/activity-chart-graph/activity-chart-graph'),
)

export interface ActivityChartPoint {
  label: string
  value: number
}

interface ActivityChartProps {
  title: string
  description?: string
  data: Array<ActivityChartPoint>
  color?: string
  loading?: boolean
  className?: string
}

export function ActivityChart({
  title,
  description,
  data,
  color = 'var(--km-primary)',
  loading = false,
  className,
}: ActivityChartProps) {
  const placeholder = <Skeleton className="h-[220px] w-full rounded-large" />

  return (
    <Card
      className={`bg-content1 rounded-large p-6 shadow-none border border-default-200${className ? ` ${className}` : ''}`}
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold text-default-800">{title}</h3>
        {description && (
          <p className="text-xs text-default-400 mt-0.5">{description}</p>
        )}
      </div>

      {loading ? (
        placeholder
      ) : (
        <Suspense fallback={placeholder}>
          <ActivityChartGraph data={data} color={color} />
        </Suspense>
      )}
    </Card>
  )
}
