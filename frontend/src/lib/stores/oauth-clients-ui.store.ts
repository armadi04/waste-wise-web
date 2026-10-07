import type { OAuthClient } from '@/lib/services/oauth-client.service'
import { createCrudModalStore } from '@/lib/stores/create-crud-modal-store'

export const useOAuthClientsUiStore = createCrudModalStore<OAuthClient>([
  'form',
])
