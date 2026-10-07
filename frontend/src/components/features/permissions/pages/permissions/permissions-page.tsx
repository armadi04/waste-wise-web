import { PermissionFormModal } from '@/components/features/permissions/modal/permission-form-modal'
import { DataTable } from '@/components/shared/datatable'
import { PageHeader } from '@/components/layout/page-header'
import { TableSkeleton } from '@/components/shared/datatable/skeletons'
import { usePermissionPage } from '@/hooks/permissions'

export function PermissionsPage() {
  const { tableProps, modalProps } = usePermissionPage()

  return (
    <div>
      <PageHeader
        title="Permissions"
        breadcrumbs={[
          { label: 'Databases' },
          { label: 'Permissions', isCurrent: true },
        ]}
      />

      {tableProps.isLoading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : (
        <DataTable {...tableProps} />
      )}
      <PermissionFormModal {...modalProps} />
    </div>
  )
}
