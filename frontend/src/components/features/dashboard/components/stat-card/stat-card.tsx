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
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    danger: 'text-danger bg-danger/10',
  }

  return (
    <Card className="bg-content1 rounded-large p-6 shadow-none border border-default-200 overflow-visible relative group text-foreground">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-default-500">{title}</span>
          {loading ? (
            <Skeleton className="h-8 w-16 rounded-large mt-1" />
          ) : (
            <span className="text-2xl font-bold tracking-tight text-foreground mt-1">
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
            className={`flex items-center font-medium ${trendUp ? 'text-success' : 'text-danger'}`}
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
