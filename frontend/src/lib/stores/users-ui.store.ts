import { createCrudModalStore } from './create-crud-modal-store'
import type { UserProfile } from '@/types/auth'

/**
 * UI state for the Users page modals:
 * - `form` — view / edit user (react-hook-form inside)
 * - `roles` — assign roles (selection modal)
 * - `permissions` — assign permissions (selection modal)
 * - `resetPassword` — reset a user's password (react-hook-form inside)
 */
export const useUsersUiStore = createCrudModalStore<UserProfile>([
  'form',
  'roles',
  'permissions',
  'resetPassword',
])
