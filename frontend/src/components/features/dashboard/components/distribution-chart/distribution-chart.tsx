import { Card, Skeleton } from '@heroui/react'
import { Suspense, lazy } from 'react'

const DistributionChartGraph = lazy(
  () =>
    import('@/components/features/dashboard/components/distribution-chart-graph/distribution-chart-graph'),
)

export interface DistributionPoint {
  label: string
  value: number
  color?: string
}

interface DistributionChartProps {
  title: string
  description?: string
  data: Array<DistributionPoint>
  loading?: boolean
  className?: string
}

export function DistributionChart({
  title,
  description,
  data,
  loading = false,
  className,
}: DistributionChartProps) {
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
      ) : data.every((item) => item.value === 0) ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-default-500">
          No report data yet.
        </div>
      ) : (
        <Suspense fallback={placeholder}>
          <DistributionChartGraph data={data} />
        </Suspense>
      )}
    </Card>
  )
}
