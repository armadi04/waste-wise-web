import type { PortalRecord } from '@/types/portal'
import { createCrudModalStore } from '@/lib/stores/create-crud-modal-store'

export const usePortalUiStore = createCrudModalStore<PortalRecord>([
  'form',
  'relation',
  'refundReject',
  'adjustPoints',
  'giftRevoke',
  'walletAdjust',
])
