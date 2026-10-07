import axios from 'axios'
import { useState } from 'react'
import type { ScanOutcome } from '@/components/features/portal/components/pass-scanner'
import type { PassKind } from '@/lib/utils/pass-token'
import { useAppMutation } from '@/hooks/global/use-mutations'
import { useUserPermission } from '@/hooks/permissions/use-permissions'
import { scanPortalPass } from '@/lib/services/portal.service'

const SCAN_ERRORS: Record<number, string> = {
  400: 'Invalid or forged code, or the wrong pass type.',
  404: 'This pass no longer exists.',
  409: 'Pass cannot be used: already used, refunded, expired or outside its check-in window.',
  410: 'QR code expired. Ask the customer to refresh it.',
}

export const scanErrorMessage = (error: unknown) => {
  if (!axios.isAxiosError(error)) return 'Verification failed. Try again.'
  const status = error.response?.status ?? 0
  const detail = (error.response?.data as { message?: unknown } | undefined)
    ?.message
  return (
    SCAN_ERRORS[status] ??
    (typeof detail === 'string' ? detail : 'Verification failed. Try again.')
  )
}

export const usePassScan = () => {
  const { hasPermission } = useUserPermission()
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null)
  const scan = useAppMutation({
    mutationFn: ({ kind, token }: { kind: PassKind; token: string }) =>
      scanPortalPass(kind, token),
    invalidateKeys: [['portal']],
    onSuccess: (_data, { kind }) =>
      setOutcome({
        kind,
        ok: true,
        message: kind === 'ticket' ? 'Ticket checked in.' : 'Voucher redeemed.',
      }),
    onError: (error, { kind }) =>
      setOutcome({ kind, ok: false, message: scanErrorMessage(error) }),
  })
  return {
    canRedeem: hasPermission('portal.vouchers.redeem'),
    canCheckIn: hasPermission('portal.tickets.check_in'),
    busy: scan.isPending,
    outcome,
    onScan: (kind: PassKind, token: string) => scan.mutate({ kind, token }),
  }
}
