import { PageHeader } from '@/components/layout/page-header'
import { DataTable } from '@/components/shared/datatable'
import { TableSkeleton } from '@/components/shared/datatable/skeletons'
import { useReportPage } from '@/hooks/reports'

export function ReportsPage() {
  const { tableProps } = useReportPage()

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Waste reports and their AI-assisted classification."
        breadcrumbs={[{ label: 'Reports', isCurrent: true }]}
      />
      {tableProps.isLoading ? (
        <TableSkeleton rows={8} columns={7} />
      ) : (
        <DataTable {...tableProps} />
      )}
    </div>
  )
}
