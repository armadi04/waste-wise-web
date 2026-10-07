import { RoleFormModal } from '@/components/features/roles/modal/role-form-modal'
import { RolePermissionsModal } from '@/components/features/roles/modal/role-permissions-modal'
import { DataTable } from '@/components/shared/datatable'
import { PageHeader } from '@/components/layout/page-header'
import { TableSkeleton } from '@/components/shared/datatable/skeletons'
import { useRolePage } from '@/hooks/roles'

export function RolesPage() {
  const { tableProps, modalProps, permissionsModalProps } = useRolePage()

  return (
    <div>
      <PageHeader
        title="Roles"
        breadcrumbs={[
          { label: 'Databases' },
          { label: 'Roles', isCurrent: true },
        ]}
      />

      {tableProps.isLoading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : (
        <DataTable {...tableProps} />
      )}
      <RoleFormModal {...modalProps} />
      <RolePermissionsModal {...permissionsModalProps} />
    </div>
  )
}
