import type { Role } from '@/types/auth'
import { createCrudModalStore } from '@/lib/stores/create-crud-modal-store'

/**
 * UI state for the Roles page modals:
 * - `form` — create / view / edit role (react-hook-form inside)
 * - `permissions` — assign permissions (selection modal)
 */
export const useRolesUiStore = createCrudModalStore<Role>([
  'form',
  'permissions',
])
