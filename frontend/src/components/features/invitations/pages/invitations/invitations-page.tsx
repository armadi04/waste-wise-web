import { InviteModal } from '@/components/features/invitations/modal/invite-modal'
import { DataTable } from '@/components/shared/datatable'
import { PageHeader } from '@/components/layout/page-header'
import { TableSkeleton } from '@/components/shared/datatable/skeletons'
import { useInvitationPage } from '@/hooks/invitations'

export function InvitationsPage() {
  const { tableProps, inviteModalProps } = useInvitationPage()

  return (
    <div>
      <PageHeader
        title="Invitations"
        breadcrumbs={[{ label: 'Invitations', isCurrent: true }]}
      />

      {tableProps.isLoading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : (
        <DataTable {...tableProps} />
      )}
      <InviteModal {...inviteModalProps} />
    </div>
  )
}
