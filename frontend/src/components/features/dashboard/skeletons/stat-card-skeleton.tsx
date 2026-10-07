import { Card, Skeleton } from '@heroui/react'

export function StatCardSkeleton() {
  return (
    <Card className="bg-content1 rounded-large p-6 shadow-none border border-default-200 border-none">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20 rounded-large" />
          <Skeleton className="h-8 w-16 rounded-large" />
        </div>
        <Skeleton className="w-10 h-10 rounded-large" />
      </div>
      <Skeleton className="h-3 w-28 rounded-large mt-4" />
    </Card>
  )
}
