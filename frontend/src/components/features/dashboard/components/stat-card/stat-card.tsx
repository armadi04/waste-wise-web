import { Card, Skeleton } from '@heroui/react'
import { TrendingUp } from 'lucide-react'

export interface StatCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  loading?: boolean
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  trend?: string
  trendUp?: boolean
}

export function StatCard({
  title,
  value,
  icon,
  loading,
  color = 'default',
  trend,
  trendUp,
}: StatCardProps) {
  const colorMap: Record<string, string> = {
    default: 'text-foreground bg-default-100',
    primary: 'text-[var(--app-link)] bg-[var(--app-selected-background)]',
    success:
      'border border-[var(--app-success-border)] app-status-success bg-[var(--app-success-background)] text-[var(--app-success-foreground)]',
    warning:
      'border border-[var(--app-warning-border)] app-status-warning bg-[var(--app-warning-background)] text-[var(--app-warning-foreground)]',
    danger:
      'border border-[var(--app-danger-border)] app-status-danger bg-[var(--app-danger-background)] text-[var(--app-danger-foreground)]',
  }

  return (
    <Card className="bg-content1 rounded-large p-4 shadow-none sm:p-6 border border-default-200 overflow-visible relative group text-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium text-default-500">{title}</span>
          {loading ? (
            <Skeleton className="h-8 w-16 rounded-large mt-1" />
          ) : (
            <span className="text-2xl font-semibold tracking-tight text-foreground mt-1">
              {value ?? 0}
            </span>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-large flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${colorMap[color]}`}
        >
          {icon}
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          <span
            className={`flex items-center font-medium ${trendUp ? 'text-[var(--app-success)]' : 'text-[var(--app-danger)]'}`}
          >
            <TrendingUp
              size={14}
              className={`mr-1 ${!trendUp ? 'rotate-180' : ''}`}
            />
            {trend}
          </span>
          <span className="text-default-400">vs last week</span>
        </div>
      )}
    </Card>
  )
}
