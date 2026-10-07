import { create } from 'zustand'

/**
 * UI state for the shared invite modal (used by both the Invitations and Users
 * pages). The invite form itself (email, role selection, validation) is local
 * react-hook-form-style state inside the modal; this store only owns the
 * open flag and the generated invite URL — the cross-component handoff state.
 */
interface InvitationsUiStore {
  isOpen: boolean
  inviteUrl: string | null
  openInvite: () => void
  setInviteUrl: (url: string | null) => void
  onOpenChange: (isOpen: boolean) => void
}

export const useInvitationsUiStore = create<InvitationsUiStore>((set) => ({
  isOpen: false,
  inviteUrl: null,
  openInvite: () => set({ isOpen: true, inviteUrl: null }),
  setInviteUrl: (inviteUrl) => set({ inviteUrl }),
  onOpenChange: (isOpen) => set({ isOpen }),
}))
