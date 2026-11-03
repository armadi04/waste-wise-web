/**
 * Zustand store barrel.
 *
 * Convention: **Zustand owns client state**, react-query owns server state,
 * URL search params own table state, and react-hook-form owns form fields.
 *
 * - Global stores: auth, sidebar, theme, background, confirmation, socket,
 *   command palette.
 * - Feature UI stores: per-page modal/selection state, built from
 *   `createCrudModalStore`.
 */

// Global stores
export { useAuthStore } from '@/lib/stores/auth.store'
export { useBackgroundStore } from '@/lib/stores/background.store'
export type { BackgroundStyle } from '@/lib/stores/background.store'
export { useCommandPaletteStore } from '@/lib/stores/command-palette.store'
export { useConfirmationStore } from '@/lib/stores/confirmation.store'
export type { ConfirmationOptions } from '@/lib/stores/confirmation.store'
export {
  useSidebar,
  useSidebarCollapsed,
  useSidebarStore,
  useSidebarWidth,
} from '@/lib/stores/sidebar.store'
export { useSocket, useSocketStore } from '@/lib/stores/socket.store'
export { useThemeStore } from '@/lib/stores/theme.store'

// Feature UI stores
export { createCrudModalStore } from '@/lib/stores/create-crud-modal-store'
export type {
  CrudModalStore,
  ModalSlot,
  OpenOptions,
} from '@/lib/stores/create-crud-modal-store'
export { useInvitationsUiStore } from '@/lib/stores/invitations-ui.store'
export { useMediaUiStore } from '@/lib/stores/media-ui.store'
export { usePermissionsUiStore } from '@/lib/stores/permissions-ui.store'
export { useReportsUiStore } from '@/lib/stores/reports-ui.store'
export { useRolesUiStore } from '@/lib/stores/roles-ui.store'
export { useUsersUiStore } from '@/lib/stores/users-ui.store'
