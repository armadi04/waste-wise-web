import type { Column } from '@/components/shared/datatable'
import type { AuditLog } from '@/lib/services/audit.service'
import { Chip } from '@/components/shared/controls'
import { formatBusinessDate as format } from '@/lib/utils/format'

/** Colour by what the action is about, so a scan of the page reads at a glance. */
const toneFor = (action: string) => {
  if (
    action.startsWith('auth.login_failed') ||
    action.startsWith('auth.locked')
  )
    return 'danger' as const
  if (action.startsWith('user.impersonat')) return 'warning' as const
  if (action.startsWith('2fa.')) return 'secondary' as const
  if (action.endsWith('_deleted') || action === 'user.deleted')
    return 'danger' as const
  return 'default' as const
}

export const getColumns = (): Array<Column<AuditLog>> => [
  {
    name: 'Action',
    uid: 'action',
    sortable: true,
    render: (item) => (
      <Chip size="sm" variant="flat" color={toneFor(item.action)}>
        <span className="font-mono text-tiny">{item.action}</span>
      </Chip>
    ),
    exportValue: (item) => item.action,
  },
  {
    name: 'Actor',
    uid: 'actorEmail',
    truncate: true,
    maxWidth: 220,
    render: (item) => (
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {item.actor?.fullname ?? (item.actorEmail ? '—' : 'System')}
        </p>
        <p className="truncate text-xs text-default-400">
          {item.actorEmail ?? ''}
        </p>
      </div>
    ),
    exportValue: (item) => item.actorEmail ?? 'system',
  },
  {
    name: 'Summary',
    uid: 'summary',
    truncate: true,
    maxWidth: 320,
    render: (item) => <span className="text-sm">{item.summary ?? '—'}</span>,
    exportValue: (item) => item.summary ?? '',
  },
  {
    name: 'Subject',
    uid: 'subjectId',
    render: (item) =>
      item.subjectType ? (
        <span className="font-mono text-xs text-default-500">
          {item.subjectType}
          {item.subjectId ? ` #${item.subjectId}` : ''}
        </span>
      ) : (
        '—'
      ),
    exportValue: (item) =>
      item.subjectType
        ? `${item.subjectType} ${item.subjectId ?? ''}`.trim()
        : '',
  },
  {
    name: 'IP Address',
    uid: 'ipAddress',
    render: (item) => (
      <span className="font-mono text-xs">{item.ipAddress ?? '—'}</span>
    ),
    exportValue: (item) => item.ipAddress ?? '',
  },
  {
    name: 'When',
    uid: 'createdAt',
    sortable: true,
    render: (item) => (
      <div>
        <p>{format(item.createdAt, 'yyyy-MM-dd HH:mm:ss')}</p>
        <code className="text-xs text-default-500">{item.createdAt} UTC</code>
      </div>
    ),
    exportValue: (item) => format(item.createdAt, 'yyyy-MM-dd HH:mm:ss'),
  },
]
