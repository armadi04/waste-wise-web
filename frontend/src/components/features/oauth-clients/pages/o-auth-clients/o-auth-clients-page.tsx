import { OAuthClientFormModal } from '@/components/features/oauth-clients/modal/oauth-client-form-modal'
import { DataTable } from '@/components/shared/datatable'
import { PageHeader } from '@/components/layout/page-header'
import { TableSkeleton } from '@/components/shared/datatable/skeletons'
import { useOAuthClientPage } from '@/hooks/oauth-clients'

export function OAuthClientsPage() {
  const { tableProps, modalProps } = useOAuthClientPage()
  return (
    <div>
      <PageHeader
        title="OAuth Clients"
        breadcrumbs={[
          { label: 'Databases' },
          { label: 'OAuth Clients', isCurrent: true },
        ]}
      />
      {tableProps.isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : (
        <DataTable {...tableProps} />
      )}
      <OAuthClientFormModal {...modalProps} />
    </div>
  )
}
