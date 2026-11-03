import type { AccountStatus } from '@/lib/constants/account-status'
import { Chip } from '@/components/shared/controls'
import {
  ACCOUNT_STATUS_COLOR,
  ACCOUNT_STATUS_LABEL,
} from '@/lib/constants/account-status'

export function AccountStatusBadge({
  status,
  emailVerifiedAt,
}: {
  status?: AccountStatus
  emailVerifiedAt?: string | null
}) {
  const resolved =
    status ?? (emailVerifiedAt ? 'ACTIVE' : 'UNVERIFIED')
  return (
    <Chip size="sm" variant="flat" color={ACCOUNT_STATUS_COLOR[resolved]}>
      {ACCOUNT_STATUS_LABEL[resolved]}
    </Chip>
  )
}
