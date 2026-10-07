import { DataTable } from '@/components/shared/datatable'
import { PageHeader } from '@/components/layout/page-header'
import { TableSkeleton } from '@/components/shared/datatable/skeletons'
import { useSessionPage } from '@/hooks/sessions'

export function SessionsPage() {
  const { tableProps } = useSessionPage()

  return (
    <div>
      <PageHeader
        title="Sessions"
        breadcrumbs={[{ label: 'Sessions', isCurrent: true }]}
      />
      {tableProps.isLoading ? (
        <TableSkeleton rows={8} columns={7} />
      ) : (
        <DataTable {...tableProps} />
      )}
    </div>
  )
}
