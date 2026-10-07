import { createCrudModalStore } from './create-crud-modal-store'
import type { Permission } from '@/types/auth'

/**
 * UI state for the Permissions page modals:
 * - `form` — create / view / edit permission (react-hook-form inside)
 */
export const usePermissionsUiStore = createCrudModalStore<Permission>(['form'])
