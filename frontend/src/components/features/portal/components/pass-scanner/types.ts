import type { PassKind } from '@/lib/utils/pass-token'

export interface ScanOutcome {
  kind: PassKind
  ok: boolean
  message: string
}
