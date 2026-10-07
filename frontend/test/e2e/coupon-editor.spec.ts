import { expect, test } from '@playwright/test'

test('coupon editor preserves edits after failure and submits ordered gallery and packages', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await context.addCookies([
    { name: 'authenticated', value: '1', domain: 'localhost', path: '/' },
  ])
  const permissions = [
    'portal.coupons.create',
    'portal.coupons.read',
    'portal.coupons.update',
    'menu.portal.coupons',
    'media.read',
    'media.create',
  ]
  const coupon = {
    id: 1,
    slug: 'test',
    title: 'Test Coupon',
    merchant: 'Merchant',
    city: 'Bandung',
    location: 'Dago',
    category: 'Venue',
    price: 10000,
    oldPrice: null,
    discount: '',
    expiresAt: '2027-01-01T00:00:00Z',
    stockTotal: 5,
    stockRemaining: 3,
    imageUrl: 'https://example.test/one.jpg',
    description: 'Description',
    benefits: 'Benefits',
    terms: 'Terms',
    redemption: 'Show voucher',
    active: true,
    images: [
      { url: 'https://example.test/one.jpg', alt: 'One' },
      { url: 'https://example.test/two.jpg', alt: 'Two' },
    ],
    packages: [
      {
        publicId: '10000000-0000-4000-8000-000000000001',
        name: 'One person',
        benefits: 'Dinner',
        price: 10000,
        oldPrice: null,
        stockTotal: 5,
        stockRemaining: 3,
        position: 0,
        active: true,
      },
    ],
  }
  let created:
    | (typeof coupon & {
        localTimes?: Record<string, string>
        timeZone?: string
      })
    | undefined
  let releaseUpload: (() => void) | undefined
  let uploads = 0
  let writes = 0
  let submitted:
    | (typeof coupon & {
        localTimes?: Record<string, string>
        timeZone?: string
      })
    | undefined
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    let json: unknown = []
    if (url.pathname === '/api/portal/time/config')
      json = {
        defaultTimeZone: 'Asia/Jakarta',
        businessTimeZones: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'],
      }
    if (url.pathname === '/api/portal/me/preferences')
      json = {
        timeZone: 'Asia/Jakarta',
        lastDetectedTimeZone: 'America/New_York',
      }
    if (url.pathname === '/api/portal/time/preview') {
      const data = route.request().postDataJSON()
      json = { ...data, instant: '2027-01-01T00:00:00.000Z' }
    }
    if (url.pathname === '/api/auth/me')
      json = {
        userId: 1,
        email: 'admin@example.test',
        roles: ['admin'],
        permissions,
        emailVerified: true,
      }
    if (url.pathname === '/api/auth/profile')
      json = {
        id: 1,
        email: 'admin@example.test',
        fullname: 'Admin',
        emailVerifiedAt: '2026-10-01T00:00:00Z',
        emailVerified: true,
        roles: [
          { name: 'admin', permissions: permissions.map((name) => ({ name })) },
        ],
        permissions: [],
      }
    if (url.pathname === '/api/notifications')
      json = { data: [], meta: { total: 0, page: 1, limit: 10, lastPage: 1 } }
    if (url.pathname === '/api/media')
      json = {
        data: [
          {
            id: 8,
            originalName: 'Library photo',
            url: 'https://example.test/library.jpg',
            mimetype: 'image/jpeg',
            isPrivate: false,
          },
        ],
        meta: { total: 1, page: 1, limit: 12, lastPage: 1 },
      }
    if (url.pathname === '/api/media/upload') {
      uploads++
      if (uploads === 1)
        await new Promise<void>((resolve) => {
          releaseUpload = resolve
        })
      if (route.request().postData()?.includes('failed.png'))
        return route.fulfill({
          status: 500,
          json: { message: 'Upload failed' },
        })
    }
    if (url.pathname === '/api/media/upload')
      json = {
        id: 9,
        originalName: 'Uploaded photo',
        url: 'https://example.test/upload.jpg',
        mimetype: 'image/png',
        isPrivate: false,
      }
    if (url.pathname === '/api/notifications/unread-count') json = 0
    if (
      url.pathname === '/api/portal/admin/coupons' &&
      route.request().method() === 'POST'
    ) {
      created = route.request().postDataJSON()
      return route.fulfill({ status: 201, json: coupon })
    }
    if (url.pathname === '/api/portal/admin/coupons')
      json = {
        data: [coupon],
        meta: { total: 1, page: 1, limit: 20, lastPage: 1 },
      }
    if (url.pathname === '/api/portal/admin/coupons/1') {
      if (route.request().method() !== 'GET') {
        submitted = route.request().postDataJSON()
        writes++
        if (writes === 1)
          return route.fulfill({
            status: 409,
            json: { message: 'Stock changed, retry' },
          })
      }
      json = coupon
    }
    await route.fulfill({ json })
  })
  await page.goto('/portal/coupons')
  await expect(page.getByRole('grid')).toBeVisible()
  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit coupon' }).click()
  const dialog = page.getByRole('dialog')
  await expect(
    dialog.getByLabel('Expires at (WIB)', { exact: true }),
  ).toHaveValue('2027-01-01T07:00')
  await expect(dialog.getByText('Photo gallery', { exact: true })).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Choose from media' }),
  ).toBeVisible()
  const [titleBounds, galleryBounds] = await Promise.all([
    dialog.getByLabel('Title', { exact: true }).boundingBox(),
    dialog.getByText('Photo gallery', { exact: true }).boundingBox(),
  ])
  expect(titleBounds!.y).toBeLessThan(galleryBounds!.y)
  await dialog.getByRole('button', { name: 'Add URL', exact: true }).click()
  await dialog.getByRole('button', { name: 'Choose from media' }).click()
  await dialog.getByRole('button', { name: 'Library photo' }).click()
  await expect(dialog.getByLabel('Photo 3 URL')).toHaveValue(
    'https://example.test/library.jpg',
  )
  await expect(dialog.getByLabel('Photo 4 URL')).toHaveCount(0)
  await dialog.getByLabel('Upload coupon photos').setInputFiles([
    { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('test') },
    { name: 'failed.png', mimeType: 'image/png', buffer: Buffer.from('test') },
  ])
  await expect(
    dialog.getByRole('button', { name: 'Save changes' }),
  ).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeDisabled()
  await expect.poll(() => Boolean(releaseUpload)).toBe(true)
  releaseUpload?.()
  await expect(dialog.getByLabel('Photo 4 URL')).toHaveValue(
    'https://example.test/upload.jpg',
  )
  await expect(dialog.getByRole('alert')).toContainText('failed.png')
  await dialog.getByLabel('Upload coupon photos').setInputFiles(
    Array.from({ length: 11 }, (_, index) => ({
      name: `extra-${index}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from('test'),
    })),
  )
  await expect(dialog.getByRole('alert')).toContainText('Maximum 10 photos')
  expect(uploads).toBe(2)
  await dialog.getByRole('button', { name: 'Move photo 2 up' }).click()
  await expect(dialog.getByLabel('Photo 1 URL')).toHaveValue(
    'https://example.test/two.jpg',
  )
  await dialog.getByLabel('Package 1 name').fill('Dinner for one')
  await dialog.getByLabel('Package 1 total stock', { exact: true }).fill('8')
  await expect(dialog.getByText('Remaining: 6', { exact: true })).toBeVisible()
  await expect(
    dialog.getByText('Total stock: 8 · Remaining stock: 6', { exact: true }),
  ).toBeVisible()
  await page.screenshot({ path: 'test-results/coupon-editor-desktop.png' })
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect.poll(() => writes).toBe(1)
  await expect(dialog.getByLabel('Package 1 name')).toHaveValue(
    'Dinner for one',
  )
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect.poll(() => writes).toBe(2)
  await expect(dialog).toBeHidden()
  expect(submitted?.expiresAt).toBeUndefined()
  expect(submitted?.timeZone).toBe('Asia/Jakarta')
  expect(submitted?.localTimes?.expiresAt).toBe('2027-01-01T07:00:00.000')
  expect(submitted?.images[0].alt).toBe('Two')
  expect(submitted?.packages[0].name).toBe('Dinner for one')
  expect(submitted?.packages[0].stockTotal).toBe(8)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(
    dialog.getByRole('heading', { name: 'Create Coupon' }),
  ).toBeVisible()
  for (const [name, value] of Object.entries({
    Title: 'New dinner',
    Merchant: 'New merchant',
    City: 'Bandung',
    Location: 'Dago',
    Category: 'Venue',
    Description: 'Description',
    Benefits: 'Benefits',
    Terms: 'Terms',
    Redemption: 'Show voucher',
    'Expires at (WIB)': '2027-01-01T20:00',
  }))
    await dialog.getByLabel(name, { exact: true }).fill(value)
  await expect(dialog.getByLabel('Slug', { exact: true })).toHaveValue(
    'new-dinner',
  )
  await dialog.getByRole('button', { name: 'Choose from media' }).click()
  await dialog.getByRole('button', { name: 'Library photo' }).click()
  await expect(dialog.getByLabel('Photo 1 URL')).toHaveValue(
    'https://example.test/library.jpg',
  )
  await expect(dialog.getByLabel('Photo 2 URL')).toHaveCount(0)
  await dialog.getByLabel('Package 1 name').fill('Dinner for two')
  await dialog.getByLabel('Price (IDR)', { exact: true }).fill('25000')
  await dialog.getByLabel('Package 1 total stock').fill('5')
  await expect(
    dialog.getByText('Starting price: Rp 25.000', { exact: true }),
  ).toBeVisible()
  await dialog.getByLabel('Title', { exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/coupon-create-desktop.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.waitForTimeout(350)
  const createBounds = await dialog
    .getByRole('button', { name: 'Create', exact: true })
    .boundingBox()
  expect(createBounds!.y + createBounds!.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: 'test-results/coupon-create-mobile.png' })
  await dialog.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(dialog).toBeHidden()
  expect(created?.expiresAt).toBeUndefined()
  expect(created?.timeZone).toBe('Asia/Jakarta')
  expect(created?.localTimes?.expiresAt).toBe('2027-01-01T20:00')
  expect(created?.images).toHaveLength(1)
  expect(created?.imageUrl).toBe('https://example.test/library.jpg')
  expect(created?.price).toBe(25000)
  expect(created?.stockTotal).toBe(5)
  expect(created?.slug).toBeUndefined()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('button', { name: 'Actions', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Edit coupon' }).click()
  await dialog
    .getByRole('combobox', { name: 'Business timezone', exact: true })
    .selectOption('Asia/Makassar')
  await expect(
    dialog.getByRole('combobox', {
      name: 'Timezone change behavior',
      exact: true,
    }),
  ).toBeVisible()
  await dialog
    .getByRole('combobox', { name: 'Timezone change behavior', exact: true })
    .selectOption('preserveInstant')
  await dialog
    .getByLabel('Reason for timezone change')
    .fill('Merchant changed zone; preserve existing deadline')
  await expect(
    dialog.getByLabel('Expires at (WITA)', { exact: true }),
  ).toHaveValue('2027-01-01T08:00')
  await dialog.getByRole('button', { name: 'Save changes' }).click()
  await expect.poll(() => writes).toBe(3)
  expect(submitted?.timeZone).toBe('Asia/Makassar')
  expect(submitted?.localTimes?.expiresAt).toBe('2027-01-01T08:00:00.000')
  expect(
    (submitted as unknown as Record<string, unknown>).timeZoneChangeMode,
  ).toBe('preserveInstant')
  expect(
    (submitted as unknown as Record<string, unknown>).timeZoneChangeReason,
  ).toContain('preserve existing deadline')
  await expect(dialog).toBeHidden()
})
