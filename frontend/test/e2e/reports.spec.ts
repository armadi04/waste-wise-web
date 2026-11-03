import {  expect, test } from '@playwright/test'
import type {Page} from '@playwright/test';

type Role = 'admin' | 'user'

const ADMIN_PERMISSIONS = [
  'reports.read.all',
  'reports.create',
  'reports.update.all',
  'reports.delete.all',
  'reports.status.update',
  'menu.reports',
  'users.read',
  'menu.users',
]

const USER_PERMISSIONS = [
  'reports.read.own',
  'reports.create',
  'reports.update.own',
  'reports.delete.own',
  'menu.reports',
]

const user = {
  id: 2,
  email: 'user@example.test',
  fullname: 'Waste User',
  emailVerifiedAt: '2026-10-01T00:00:00Z',
  accountStatus: 'ACTIVE',
  registerMethod: 'SEEDER',
  roles: [{ id: 2, name: 'user' }],
  permissions: [],
  createdAt: '2026-10-01T00:00:00Z',
}

const report = {
  id: 1,
  reporterId: 2,
  reporter: user,
  media: {
    id: 9,
    url:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0ZkAAAAASUVORK5CYII=',
    filename: 'waste.png',
    mimetype: 'image/png',
  },
  mediaId: 9,
  description: 'Plastic bottle pile',
  latitude: -6.2,
  longitude: 106.8,
  predictedCategory: 'PLASTIC_WASTE',
  confidence: 0.94,
  modelVersion: '1.0.0',
  classificationStatus: 'COMPLETED',
  classificationError: null,
  status: 'PENDING',
  createdAt: '2026-10-01T01:00:00Z',
  updatedAt: '2026-10-01T01:00:00Z',
}

async function installApiMocks(page: Page, role: Role) {
  const permissions = role === 'admin' ? ADMIN_PERMISSIONS : USER_PERMISSIONS
  const state = {
    reportListRequests: [] as Array<string>,
    createBodies: [] as Array<Record<string, unknown>>,
    statusBodies: [] as Array<Record<string, unknown>>,
    mediaUploads: 0,
    currentReport: { ...report },
  }

  await page.context().addCookies([
    { name: 'authenticated', value: '1', domain: 'localhost', path: '/' },
  ])

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()

    if (path === '/api/v1/auth/me') {
      return route.fulfill({
        json: {
          sub: role === 'admin' ? 1 : 2,
          userId: role === 'admin' ? 1 : 2,
          email: role === 'admin' ? 'admin@example.test' : user.email,
          roles: [role === 'admin' ? 'superadmin' : 'user'],
          permissions,
          emailVerified: true,
          activeRole: role === 'admin' ? 'superadmin' : 'user',
        },
      })
    }
    if (path === '/api/v1/auth/profile') {
      return route.fulfill({
        json: {
          ...user,
          id: role === 'admin' ? 1 : 2,
          email: role === 'admin' ? 'admin@example.test' : user.email,
          fullname: role === 'admin' ? 'Admin Test' : user.fullname,
          roles: [
            {
              id: role === 'admin' ? 1 : 2,
              name: role === 'admin' ? 'superadmin' : 'user',
              permissions: permissions.map((name) => ({ name })),
            },
          ],
          permissions: permissions.map((name) => ({ name })),
        },
      })
    }
    if (path === '/api/v1/notifications/unread-count') return route.fulfill({ json: 0 })
    if (path === '/api/v1/notifications')
      return route.fulfill({
        json: { data: [], meta: { total: 0, page: 1, lastPage: 1 } },
      })
    if (path === '/api/v1/stats/reports') {
      return route.fulfill({
        json: {
          total: 1,
          pending: 1,
          inProgress: 0,
          completed: 0,
          rejected: 0,
          byCategory: { organic: 0, plastic: 1, paper: 0, unclassified: 0 },
          recentReports: [state.currentReport],
        },
      })
    }
    if (path === '/api/v1/users') {
      if (url.searchParams.get('paginated') === 'true') {
        return route.fulfill({
          json: {
            data: [user],
            meta: { total: 1, page: 1, lastPage: 1 },
          },
        })
      }
      return route.fulfill({ json: [user] })
    }
    if (path === '/api/v1/media/upload' && method === 'POST') {
      state.mediaUploads += 1
      return route.fulfill({ status: 201, json: state.currentReport.media })
    }
    if (path === '/api/v1/reports' && method === 'GET') {
      state.reportListRequests.push(url.search)
      return route.fulfill({
        json: { data: [state.currentReport], meta: { total: 1, page: 1, lastPage: 1 } },
      })
    }
    if (path === '/api/v1/reports' && method === 'POST') {
      state.createBodies.push(request.postDataJSON())
      state.currentReport = { ...state.currentReport, id: 1 }
      return route.fulfill({ status: 201, json: state.currentReport })
    }
    if (path === '/api/v1/reports/1' && method === 'GET') {
      if (role === 'user' && state.currentReport.reporterId !== 2)
        return route.fulfill({ status: 403, json: { message: 'Forbidden' } })
      return route.fulfill({ json: state.currentReport })
    }
    if (path === '/api/v1/reports/1/status' && method === 'PATCH') {
      const body = request.postDataJSON()
      state.statusBodies.push(body)
      state.currentReport = { ...state.currentReport, status: body.status }
      return route.fulfill({ json: state.currentReport })
    }
    if (path === '/api/v1/reports/2' && method === 'GET') {
      return route.fulfill({ status: 403, json: { message: 'Forbidden' } })
    }
    if (path === '/api/v1/reports/1' && method === 'DELETE') {
      return route.fulfill({ json: { deleted: true } })
    }
    if (path === '/api/v1/audit-logs') {
      return route.fulfill({
        json: { data: [], meta: { total: 0, page: 1, lastPage: 1 } },
      })
    }
    return route.fulfill({ json: {} })
  })

  return state
}

test('admin report list keeps filters in URL and exposes admin columns', async ({
  page,
}) => {
  const state = await installApiMocks(page, 'admin')
  const errors: Array<string> = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(
    '/reports?page=2&search=plastic&status=PENDING&category=PLASTIC_WASTE',
  )
  await expect(page.getByRole('grid', { name: 'Data table' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Reporter' })).toBeVisible()
  expect(
    state.reportListRequests.some(
      (search) =>
        search.includes('status=PENDING') &&
        search.includes('category=PLASTIC_WASTE') &&
        search.includes('search=plastic') &&
        search.includes('page=2'),
    ),
  ).toBe(true)

  await page.getByLabel('Filter status').selectOption('COMPLETED')
  await expect
    .poll(() => new URL(page.url()).searchParams.get('status'))
    .toBe('COMPLETED')
  await expect
    .poll(() => new URL(page.url()).searchParams.get('page'))
    .toBe('1')
  expect(new URL(page.url()).searchParams.get('category')).toBe(
    'PLASTIC_WASTE',
  )
  expect(new URL(page.url()).searchParams.get('search')).toBe('plastic')

  await page.screenshot({
    path: 'test-results/reports-list-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('grid', { name: 'Data table' })).toBeVisible()
  await page.screenshot({
    path: 'test-results/reports-list-mobile.png',
    fullPage: true,
  })
  await page.evaluate(() =>
    localStorage.setItem(
      'theme-store',
      JSON.stringify({ state: { isDark: true }, version: 0 }),
    ),
  )
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.screenshot({
    path: 'test-results/reports-list-dark-mobile.png',
    fullPage: true,
  })
  expect(errors).toEqual([])
})

test('admin creates a report and updates its status', async ({ page }) => {
  const state = await installApiMocks(page, 'admin')
  const errors: Array<string> = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/reports/new')
  await page.getByLabel('Description').fill('New plastic waste report')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'waste.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0ZkAAAAASUVORK5CYII=',
      'base64',
    ),
  })
  await page.getByRole('button', { name: 'Create report' }).click()

  await expect(page).toHaveURL(/\/reports\/1$/)
  await expect(page.getByText('Report #1')).toBeVisible()
  expect(state.mediaUploads).toBe(1)
  expect(state.createBodies[0]).toMatchObject({
    description: 'New plastic waste report',
    mediaId: 9,
  })

  await page.getByLabel('Update report status').selectOption('IN_PROGRESS')
  await expect.poll(() => state.statusBodies.length).toBe(1)
  expect(state.statusBodies[0]).toEqual({ status: 'IN_PROGRESS' })
  await expect(page.getByText('In Progress', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('user cannot reach user management or change report status', async ({
  page,
}) => {
  await installApiMocks(page, 'user')
  const errors: Array<string> = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/users')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: 'Reports' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Users' })).not.toBeVisible()

  await page.goto('/reports')
  await expect(page.getByRole('grid', { name: 'Data table' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Reporter' })).toBeHidden()

  await page.goto('/reports/1')
  await expect(page.getByRole('heading', { name: 'Report #1' })).toBeVisible()
  await expect(page.getByLabel('Update report status')).not.toBeVisible()

  await page.goto('/reports/2')
  await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible()
  expect(errors).toEqual([])
})
