import {  expect, test } from '@playwright/test'
import type {Page} from '@playwright/test';

const admin = {
  id: 1,
  email: 'admin@example.test',
  fullname: 'Admin Test',
  emailVerifiedAt: '2026-10-01T00:00:00Z',
  accountStatus: 'ACTIVE',
  isActive: true,
  registerMethod: 'SEEDER',
  roles: [{ id: 1, name: 'superadmin' }],
  permissions: [],
  createdAt: '2026-10-01T00:00:00Z',
}

const target = {
  id: 2,
  email: 'target@example.test',
  fullname: 'Target User',
  emailVerifiedAt: '2026-10-01T00:00:00Z',
  accountStatus: 'ACTIVE',
  isActive: true,
  registerMethod: 'INVITATION',
  roles: [{ id: 2, name: 'user' }],
  permissions: [],
  createdAt: '2026-10-01T00:00:00Z',
}

const permissions = [
  'users.read',
  'users.update',
  'users.manage_status',
  'menu.users',
]

async function mockUsers(page: Page, profilePermissions = permissions) {
  const state = {
    statusBodies: [] as Array<Record<string, unknown>>,
    target: { ...target },
  }
  await page.context().addCookies([
    { name: 'authenticated', value: '1', domain: 'localhost', path: '/' },
  ])
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()
    if (path === '/api/v1/auth/me') {
      return route.fulfill({
        json: {
          sub: 1,
          userId: 1,
          email: admin.email,
          roles: ['superadmin'],
          permissions: profilePermissions,
          emailVerified: true,
          activeRole: 'superadmin',
        },
      })
    }
    if (path === '/api/v1/auth/profile') {
      return route.fulfill({
        json: {
          ...admin,
          roles: [
            {
              id: 1,
              name: 'superadmin',
              permissions: profilePermissions.map((name) => ({ name })),
            },
          ],
          permissions: profilePermissions.map((name) => ({ name })),
        },
      })
    }
    if (path === '/api/v1/notifications/unread-count') return route.fulfill({ json: 0 })
    if (path === '/api/v1/notifications')
      return route.fulfill({
        json: { data: [], meta: { total: 0, page: 1, lastPage: 1 } },
      })
    if (path === '/api/v1/users' && method === 'GET') {
      const data = [admin, state.target]
      if (url.searchParams.get('paginated') === 'false') return route.fulfill({ json: data })
      return route.fulfill({
        json: { data, meta: { total: data.length, page: 1, lastPage: 1 } },
      })
    }
    if (path === '/api/v1/users/2/status' && method === 'PATCH') {
      const body = route.request().postDataJSON() as { isActive: boolean }
      state.statusBodies.push(body)
      state.target = {
        ...state.target,
        isActive: body.isActive,
        accountStatus: body.isActive ? 'ACTIVE' : 'INACTIVE',
      }
      return route.fulfill({ json: state.target })
    }
    if (path === '/api/v1/roles')
      return route.fulfill({ json: [] })
    if (path === '/api/v1/permissions')
      return route.fulfill({ json: [] })
    if (path === '/api/v1/sessions')
      return route.fulfill({
        json: { data: [], meta: { total: 0, page: 1, lastPage: 1 } },
      })
    return route.fulfill({ json: {} })
  })
  return state
}

test('admin deactivates and reactivates a user without action on self', async ({
  page,
}) => {
  const state = await mockUsers(page)
  const errors: Array<string> = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/users')
  const targetRow = page.getByRole('row').filter({ hasText: 'Target User' })
  const selfRow = page.getByRole('row').filter({ hasText: 'Admin Test' })
  await expect(targetRow.getByText('Active')).toBeVisible()

  const targetActions = targetRow.getByRole('button', { name: /Actions for/ })
  await targetActions.click()
  await page.waitForTimeout(500)
  const deactivate = page.getByRole('menuitem', { name: 'Deactivate user' })
  if (!(await deactivate.isVisible())) {
    await targetActions.click()
  }
  await expect(deactivate).toBeVisible()
  await deactivate.click()
  await expect(
    page.getByRole('button', { name: 'Deactivate user', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Deactivate user', exact: true }).click()

  await expect.poll(() => state.statusBodies.length).toBe(1)
  expect(state.statusBodies[0]).toEqual({ isActive: false })
  await expect(targetRow.getByText('Inactive')).toBeVisible()

  await targetRow.getByRole('button', { name: /Actions for/ }).click()
  await page.getByRole('menuitem', { name: 'View details' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Account Status')).toBeVisible()
  await expect(dialog.getByText('Inactive', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).last().click()
  await expect(dialog).toBeHidden()

  await targetRow.getByRole('button', { name: /Actions for/ }).click()
  await page.getByRole('menuitem', { name: 'Activate user' }).click()
  await page.getByRole('button', { name: 'Activate user', exact: true }).click()
  await expect.poll(() => state.statusBodies.length).toBe(2)
  expect(state.statusBodies[1]).toEqual({ isActive: true })
  await expect(targetRow.getByText('Active')).toBeVisible()

  await selfRow.getByRole('button', { name: /Actions for/ }).click()
  await expect(page.getByRole('menuitem', { name: 'Deactivate user' })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('status action is hidden without users.manage_status', async ({ page }) => {
  await mockUsers(page, ['users.read', 'menu.users'])
  await page.goto('/users')
  const targetRow = page.getByRole('row').filter({ hasText: 'Target User' })
  await targetRow.getByRole('button', { name: /Actions for/ }).click()
  await expect(page.getByRole('menuitem', { name: 'Deactivate user' })).toHaveCount(0)
})
