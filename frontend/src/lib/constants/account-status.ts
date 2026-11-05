import type { User } from '@/types/api'

export type AccountStatus = NonNullable<User['accountStatus']>

export const ACCOUNT_STATUS_VALUES = [
  'INACTIVE',
  'ACTIVE',
  'UNVERIFIED',
  'LOCKED',
] as const satisfies ReadonlyArray<AccountStatus>

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  INACTIVE: 'Inactive',
  ACTIVE: 'Active',
  UNVERIFIED: 'Unverified',
  LOCKED: 'Locked',
}

export const ACCOUNT_STATUS_COLOR: Record<
  AccountStatus,
  'success' | 'warning' | 'danger'
> = {
  INACTIVE: 'danger',
  ACTIVE: 'success',
  UNVERIFIED: 'warning',
  LOCKED: 'danger',
}
