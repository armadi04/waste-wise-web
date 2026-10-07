import { Card, Skeleton } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { Activity } from 'lucide-react'
import type { AuditLog } from '@/lib/services/audit.service'

interface RecentActivityProps {
  data: Array<AuditLog>
  loading?: boolean
  className?: string
}

/** The newest audit entries, as a feed. The full trail lives at /audit-logs. */
export function RecentActivity({
  data,
  loading = false,
  className,
}: RecentActivityProps) {
  return (
    <Card
      className={`rounded-large border border-default-200 bg-content1 p-6 shadow-none${
        className ? ` ${className}` : ''
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-default-800">
            Recent Activity
          </h3>
          <p className="mt-0.5 text-xs text-default-400">
            Latest changes across the system
          </p>
        </div>
        <Link
          to="/audit-logs"
          className="shrink-0 text-xs text-[var(--app-link)] underline-offset-2 hover:underline"
        >
          View all
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-medium" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="py-6 text-center text-sm text-default-400">
          No activity recorded yet
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-default-100">
          {data.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-medium bg-[var(--app-selected-background)] text-[var(--app-link)]">
                <Activity size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {entry.summary ?? entry.action}
                </p>
                <p className="truncate text-xs text-default-400">
                  {entry.actor?.fullname ?? entry.actorEmail ?? 'System'}
                  {entry.subjectType ? ` · ${entry.subjectType}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-xs text-default-400">
                {formatDistanceToNow(new Date(entry.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
