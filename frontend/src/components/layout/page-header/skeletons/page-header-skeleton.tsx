import { Skeleton } from '@heroui/react'

export function PageHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-2 mb-6 pt-4">
      <Skeleton className="h-3 w-32 rounded-large" />
      <Skeleton className="h-8 w-48 rounded-large" />
    </div>
  )
}
