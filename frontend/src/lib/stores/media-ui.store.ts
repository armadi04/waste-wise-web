import { createCrudModalStore } from './create-crud-modal-store'
import type { Media } from '@/types/media'

/**
 * UI state for the Media page modals:
 * - `view` — media detail / preview
 */
export const useMediaUiStore = createCrudModalStore<Media>(['view'])
