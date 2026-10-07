import { Skeleton } from '@heroui/react'

interface TableSkeletonProps {
  rows?: number
  columns?: number
}

const widthCycle = ['w-full', 'w-3/4', 'w-1/2'] as const

export function TableSkeleton({ rows = 8, columns = 5 }: TableSkeletonProps) {
  return (
    <div className="bg-content1 rounded-large p-6 shadow-none border border-default-200">
      <Skeleton className="h-10 w-64 rounded-large mb-4" />

      <div className="divide-y divide-default-100">
        {/* Header row */}
        <div className="flex gap-4 pb-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1 rounded" />
          ))}
        </div>

        {/* Data rows */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex gap-4 py-3">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div key={colIdx} className="flex-1">
                <Skeleton
                  className={`h-4 rounded ${widthCycle[(rowIdx + colIdx) % 3]}`}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
