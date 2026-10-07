import { Divider, Skeleton } from '@heroui/react'

export function DetailsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-32 rounded-full" />
        ))}
      </div>
      <Divider className="opacity-50" />
      {[0, 1].map((section) => (
        <div key={section} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-large" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-16 rounded-medium" />
              <Skeleton className="h-2.5 w-12 rounded-medium" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pl-1">
            {Array.from({ length: section === 0 ? 2 : 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-24 rounded-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
