import type { TwoFactorStep } from '@/hooks/profile'
import type { TwoFactorEnrollment } from '@/lib/services/two-factor.service'

export interface TwoFactorModalProps {
  step: TwoFactorStep | null
  onClose: () => void
  code: string
  setCode: (value: string) => void
  enrollment?: TwoFactorEnrollment
  recoveryCodes: Array<string>
  onConfirm: () => void
  onDisable: () => void
  onRegenerate: () => void
  isConfirming: boolean
  isDisabling: boolean
  isRegenerating: boolean
}
