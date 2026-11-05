import type { Report } from '@/types/api'
import { createCrudModalStore } from '@/lib/stores/create-crud-modal-store'

export const useReportsUiStore = createCrudModalStore<Report>(['edit'])
