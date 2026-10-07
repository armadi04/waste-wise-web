import type { OAuthClientFormData } from '@/lib/schemas/oauth-clients'
import type { OAuthClient } from '@/lib/services/oauth-client.service'

export interface OAuthClientFormModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  editingClient: OAuthClient | null
  onSubmit: (data: OAuthClientFormData) => void
  isLoading?: boolean
  isReadOnly?: boolean
  /** Available scopes to grant (permission names). */
  scopeOptions: Array<string>
  /** Set once after a successful create, to reveal the plaintext secret. */
  createdSecret?: { clientId: string; clientSecret: string } | null
}
