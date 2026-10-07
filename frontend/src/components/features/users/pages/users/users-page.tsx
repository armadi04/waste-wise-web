import { InviteModal } from '@/components/features/invitations/modal/invite-modal'
import { ResetPasswordModal } from '@/components/features/users/modal/reset-password-modal'
import { UserFormModal } from '@/components/features/users/modal/user-form-modal'
import { UserPermissionsModal } from '@/components/features/users/modal/user-permissions-modal'
import { UserRolesModal } from '@/components/features/users/modal/user-roles-modal'
import { DataTable } from '@/components/shared/datatable'
import { PageHeader } from '@/components/layout/page-header'
import { TableSkeleton } from '@/components/shared/datatable/skeletons'
import { useUserPage } from '@/hooks/users'

export function UsersPage() {
  const {
    tableProps,
    inviteModalProps,
    modalProps,
    rolesModalProps,
    permissionsModalProps,
    resetPasswordModalProps,
  } = useUserPage()

  return (
    <div>
      <PageHeader
        title="Users"
        breadcrumbs={[{ label: 'Users', isCurrent: true }]}
      />

      {tableProps.isLoading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : (
        <DataTable {...tableProps} />
      )}
      <InviteModal {...inviteModalProps} />
      <UserFormModal {...modalProps} />
      <UserRolesModal {...rolesModalProps} />
      <UserPermissionsModal {...permissionsModalProps} />
      <ResetPasswordModal {...resetPasswordModalProps} />
    </div>
  )
}
