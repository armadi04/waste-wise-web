import { expect, test } from '@playwright/test'

test('refresh CSRF rejection redirects a stale session to login', async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: 'authenticated', value: '1', domain: 'localhost', path: '/' },
  ])
  const errors: Array<string> = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
  )
  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({ status: 403, json: { message: 'Invalid CSRF token' } }),
  )

  await page.goto('/users')
  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole('button', { name: 'Sign In', exact: true }),
  ).toBeVisible()
  expect(
    (await context.cookies()).some((cookie) => cookie.name === 'authenticated'),
  ).toBe(false)
  expect(errors).toEqual([])
})

test('direct session 403 renders access denied with sign-in navigation', async ({
  page,
}) => {
  const warnings: Array<string> = []
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text())
  })
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ status: 403, json: { message: 'Forbidden' } }),
  )

  await page.goto('/users')
  await expect(
    page.getByRole('heading', { name: 'Access Denied' }),
  ).toBeVisible()
  expect(
    warnings.filter((warning) =>
      warning.includes("wasn't caught by any route"),
    ),
  ).toEqual([])
  await page.getByRole('button', { name: 'Go to sign in' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('temporary refresh failure retains the session and retries route loading', async ({
  page,
  context,
}) => {
  await context.addCookies([
    { name: 'authenticated', value: '1', domain: 'localhost', path: '/' },
    { name: 'csrfToken', value: 'valid-token', domain: 'localhost', path: '/' },
  ])
  let recovered = false
  await page.route('**/api/v1/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/api/v1/auth/refresh') {
      await route.fulfill({
        status: 503,
        json: { message: 'Service unavailable' },
      })
      return
    }
    if (pathname === '/api/v1/auth/me') {
      await route.fulfill(
        recovered
          ? {
              json: {
                userId: 1,
                email: 'admin@example.test',
                roles: ['admin'],
                permissions: ['users.read', 'menu.users'],
                emailVerified: true,
              },
            }
          : { status: 401, json: { message: 'Unauthorized' } },
      )
      return
    }
    let payload: unknown = []
    if (pathname === '/api/v1/auth/profile') {
      payload = {
        id: 1,
        email: 'admin@example.test',
        fullname: 'Admin Test',
        emailVerified: true,
        emailVerifiedAt: '2026-09-30T00:00:00Z',
        roles: [
          {
            name: 'admin',
            permissions: [{ name: 'users.read' }, { name: 'menu.users' }],
          },
        ],
        permissions: [],
      }
    }
    if (pathname === '/api/v1/users' || pathname === '/api/v1/notifications') {
      payload = {
        data: [],
        meta: { total: 0, page: 1, limit: 20, lastPage: 1 },
      }
    }
    if (pathname === '/api/v1/notifications/unread-count') payload = 0
    await route.fulfill({ json: payload })
  })

  await page.goto('/users')
  await expect(
    page.getByRole('heading', { name: 'Unable to load this page' }),
  ).toBeVisible()
  expect(
    (await context.cookies()).some((cookie) => cookie.name === 'authenticated'),
  ).toBe(true)
  recovered = true
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('grid', { name: 'Data table' })).toBeVisible()
  await expect(page).toHaveURL(/\/users$/)
})
