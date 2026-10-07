import { useAppMutation } from '@/hooks/global/use-mutations'
import { useAllRoles } from '@/hooks/roles/use-roles'
import { createInvitation } from '@/lib/services/invitation.service'
import { useInvitationsUiStore } from '@/lib/stores/invitations-ui.store'

/**
 * Shared invite-generation modal. Used by both the Invitations page and the
 * Users page so an admin can invite from either place. Open state + the
 * generated URL live in {@link useInvitationsUiStore}; the create call is a
 * react-query mutation.
 */
export function useInviteModal() {
  const { data: allRoles = [] } = useAllRoles()
  const isOpen = useInvitationsUiStore((s) => s.isOpen)
  const inviteUrl = useInvitationsUiStore((s) => s.inviteUrl)
  const openInvite = useInvitationsUiStore((s) => s.openInvite)
  const onOpenChange = useInvitationsUiStore((s) => s.onOpenChange)
  const setInviteUrl = useInvitationsUiStore((s) => s.setInviteUrl)

  const createMutation = useAppMutation({
    mutationFn: createInvitation,
    invalidateKeys: ['invitations'],
    onSuccess: (result) => setInviteUrl(result.inviteUrl),
  })

  return {
    openInvite,
    inviteModalProps: {
      isOpen,
      onOpenChange,
      allRoles,
      isLoading: createMutation.isPending,
      inviteUrl,
      onGenerate: (payload: { email: string; roleIds: Array<number> }) =>
        createMutation.mutate(payload),
      onReset: () => setInviteUrl(null),
    },
  }
}
