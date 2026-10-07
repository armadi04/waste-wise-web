import { readFileSync } from 'node:fs'
import XLSX from 'xlsx'
import { expect, test } from '@playwright/test'

test('admin deep link loads filtered data once and keeps pagination in URL', async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: 'authenticated', value: '1', domain: 'localhost', path: '/' },
  ])
  const users: Array<string> = []
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    let payload: unknown = []
    if (url.pathname === '/api/notifications')
      payload = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, lastPage: 1 },
      }
    if (url.pathname === '/api/auth/me')
      payload = {
        userId: 1,
        email: 'admin@example.test',
        roles: ['admin'],
        permissions: ['users.read', 'menu.users'],
        emailVerified: true,
      }
    if (url.pathname === '/api/auth/profile')
      payload = {
        id: 1,
        email: 'admin@example.test',
        fullname: 'Admin Test',
        emailVerifiedAt: '2026-09-30T00:00:00Z',
        emailVerified: true,
        roles: [
          {
            name: 'admin',
            permissions: [{ name: 'users.read' }, { name: 'menu.users' }],
          },
        ],
        permissions: [],
      }
    if (url.pathname === '/api/users') {
      users.push(url.search)
      payload = {
        data: [
          {
            id: 2,
            email: 'alice@example.test',
            fullname: 'Alice',
            roles: [],
            permissions: [],
            createdAt: '2026-10-01T01:00:00Z',
            registerMethod: url.searchParams.get('registerMethod') ?? 'EMAIL_OTP',
          },
        ],
        meta: {
          total: 21,
          page: Number(url.searchParams.get('page') ?? 1),
          limit: 20,
          lastPage: 2,
        },
      }
    }
    if (
      url.pathname === '/api/users' &&
      url.searchParams.get('paginated') === 'false'
    )
      payload = (payload as { data: unknown }).data
    if (url.pathname === '/api/notifications/unread-count') payload = 0
    await route.fulfill({ json: payload })
  })
  const errors: Array<string> = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(
    'http://localhost:32012/users?page=2&search=Alice&createdIn=7d&registerMethod=EMAIL_OTP',
  )
  await expect(page.getByRole('grid', { name: 'Data table' })).toBeVisible()
  expect(users).toHaveLength(1)
  expect(new URLSearchParams(users[0]).get('page')).toBe('2')
  expect(new URLSearchParams(users[0]).get('search')).toBe('Alice')
  expect(new URLSearchParams(users[0]).get('createdIn')).toBe('7d')
  expect(new URLSearchParams(users[0]).get('registerMethod')).toBe('EMAIL_OTP')
  await expect(
    page.getByRole('columnheader', { name: 'Register Method' }),
  ).toBeVisible()
  await expect(page.getByRole('grid').getByText('Email & OTP')).toBeVisible()

  await page.getByRole('button', { name: '7 hari terakhir' }).click()
  await page.getByRole('menuitemradio', { name: 'Per hari ini' }).click()
  await expect
    .poll(() => new URL(page.url()).searchParams.get('createdIn'))
    .toBe('today')
  await expect
    .poll(() => new URL(page.url()).searchParams.get('page'))
    .toBe('1')
  expect(new URL(page.url()).searchParams.get('registerMethod')).toBe(
    'EMAIL_OTP',
  )
  expect(new URL(page.url()).searchParams.get('search')).toBe('Alice')

  await page.getByRole('button', { name: 'Email & OTP', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Google', exact: true }).click()
  await expect
    .poll(() => new URL(page.url()).searchParams.get('registerMethod'))
    .toBe('GOOGLE')
  await page.goBack()
  await expect(
    page.getByRole('button', { name: 'Email & OTP', exact: true }),
  ).toBeVisible()
  await page.goForward()
  await expect(
    page.getByRole('button', { name: 'Google', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Per hari ini' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Google', exact: true }),
  ).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const download = await downloadPromise
  const downloadPath = await download.path()
  if (!downloadPath) throw new Error('Export download is unavailable')
  const workbook = XLSX.read(readFileSync(downloadPath), { type: 'buffer' })
  const exported = XLSX.utils.sheet_to_json<Record<string, string>>(
    workbook.Sheets.Users,
  )
  expect(exported[0]['Register Method']).toBe('Google')
  const exportRequest = new URLSearchParams(users.at(-1))
  expect(exportRequest.get('paginated')).toBe('false')
  expect(exportRequest.get('createdIn')).toBe('today')
  expect(exportRequest.get('registerMethod')).toBe('GOOGLE')
  expect(exportRequest.get('search')).toBe('Alice')
  expect(exportRequest.has('page')).toBe(false)

  await page.screenshot({
    path: 'test-results/users-filters-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Per hari ini' })).toBeVisible()
  await page.screenshot({
    path: 'test-results/users-filters-mobile.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Per hari ini' }).click()
  await page.getByRole('menuitemradio', { name: 'Semua', exact: true }).click()
  await expect
    .poll(() => new URL(page.url()).searchParams.has('createdIn'))
    .toBe(false)
  await page.getByRole('button', { name: 'Google', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Semua metode daftar' }).click()
  await expect
    .poll(() => new URL(page.url()).searchParams.has('registerMethod'))
    .toBe(false)
  expect(errors).toEqual([])
})

test('admin signed-out deep links redirect after validating the session', async ({
  page,
}) => {
  const errors: Array<string> = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
  )
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
  )
  await page.goto('http://localhost:32012/users')
  await expect(page).toHaveURL('http://localhost:32012/login')
  expect(errors).toEqual([])
})
