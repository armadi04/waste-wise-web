import { Skeleton } from '@heroui/react'

/**
 * Placeholders that mirror `MediaCard` / `MediaRow` exactly — same grid
 * columns, same heights, same padding — so the content does not jump when the
 * real data arrives, which would read as lag rather than loading.
 */

export function MediaGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-large border border-default-100 bg-content1"
        >
          <div className="flex aspect-square items-center justify-center border-b border-default-100 bg-default-50/50">
            <Skeleton className="size-14 rounded-large" />
          </div>
          <div className="flex flex-col gap-1.5 px-2.5 py-2">
            <Skeleton className="h-3 w-3/4 rounded" />
            <Skeleton className="h-2.5 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MediaListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-large border border-default-100 bg-content1 px-4 py-2.5"
        >
          <Skeleton className="size-9 shrink-0 rounded-medium" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/3 rounded" />
            <Skeleton className="h-2.5 w-1/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
