import { describe, expect, it } from 'vitest'
import { getColumns } from '@/components/features/users/components/table-columns'
import { userSearchSchema } from '@/lib/schemas/users'
import {
  ACCOUNT_STATUS_COLOR,
  ACCOUNT_STATUS_LABEL,
} from '@/lib/constants/account-status'

const baseParams = {
  onView: () => undefined,
  onEdit: () => undefined,
  onDelete: () => undefined,
  onToggleActive: () => undefined,
  onManageRoles: () => undefined,
  onManagePermissions: () => undefined,
  onResetPassword: () => undefined,
  onImpersonate: () => undefined,
  hasPermission: () => true,
  currentUserId: 1,
}

describe('user account status', () => {
  it('has explicit labels and non-color status meaning', () => {
    expect(ACCOUNT_STATUS_LABEL).toEqual({
      INACTIVE: 'Inactive',
      ACTIVE: 'Active',
      UNVERIFIED: 'Unverified',
      LOCKED: 'Locked',
    })
    expect(ACCOUNT_STATUS_COLOR.LOCKED).toBe('danger')
    expect(ACCOUNT_STATUS_COLOR.INACTIVE).toBe('danger')
  })

  it('adds Account Status and role-name columns to the users table', () => {
    const columns = getColumns(baseParams)
    expect(columns.map((column) => column.uid)).toContain('accountStatus')
    const roles = columns.find((column) => column.uid === 'roles')
    expect(roles?.exportValue?.({
      roles: [{ id: 1, name: 'superadmin' }],
    } as never)).toBe('superadmin')
  })

  it('accepts an account-status filter in the URL schema', () => {
    expect(userSearchSchema.parse({ accountStatus: 'INACTIVE' })).toEqual({
      accountStatus: 'INACTIVE',
    })
  })
})
