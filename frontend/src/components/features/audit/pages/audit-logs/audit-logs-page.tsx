import { Select, SelectItem } from '@heroui/react'
import { DataTable } from '@/components/shared/datatable'
import { PageHeader } from '@/components/layout/page-header'
import { TableSkeleton } from '@/components/shared/datatable/skeletons'
import { useAuditLogPage } from '@/hooks/audit'

export function AuditLogsPage() {
  const { tableProps, actions, action, onActionChange } = useAuditLogPage()

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        breadcrumbs={[{ label: 'Audit Trail', isCurrent: true }]}
      />
      {tableProps.isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <DataTable
          {...tableProps}
          headerActions={
            <Select
              aria-label="Filter by action"
              placeholder="All actions"
              size="sm"
              className="w-52"
              selectedKeys={action ? [action] : []}
              onChange={(e) => onActionChange(e.target.value)}
            >
              {actions.map((name) => (
                <SelectItem key={name}>{name}</SelectItem>
              ))}
            </Select>
          }
        />
      )}
    </div>
  )
}
