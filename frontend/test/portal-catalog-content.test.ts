import { afterEach, describe, expect, it, vi } from 'vitest'
import { broadcastFormExtension } from '@/components/features/portal/components/broadcast-form-extension'
import { contentFormToInput } from '@/components/features/portal/components/content-editor/lib/content-editor-helpers'
import {
  portalCapabilities,
  portalResourceConfig,
} from '@/components/features/portal/lib/config'
import { portalContentFormSchema } from '@/lib/schemas/portal'
import { savePortalContent } from '@/lib/services/portal.service'

const api = vi.hoisted(() => ({ put: vi.fn() }))
vi.mock('@/lib/api', () => ({
  apiPut: api.put,
  apiPost: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}))
afterEach(() => {
  vi.resetAllMocks()
})

describe('curated catalog lookups', () => {
  it('coupons and events pick categories and cities from curated lists', () => {
    const coupon = portalResourceConfig('coupons')!.fields
    expect(coupon.find((field) => field.key === 'category')).toMatchObject({
      type: 'lookup',
      lookup: 'coupon-categories',
    })
    expect(coupon.find((field) => field.key === 'city')).toMatchObject({
      type: 'lookup',
      lookup: 'cities',
    })
    expect(
      portalResourceConfig('events')!.fields.find(
        (field) => field.key === 'city',
      ),
    ).toMatchObject({ type: 'lookup', lookup: 'cities' })
  })

  it('broadcasts can be sent but never edited or deleted', () => {
    expect(portalCapabilities(portalResourceConfig('broadcasts'))).toEqual({
      create: true,
      update: false,
      delete: false,
      bulkDelete: false,
    })
  })
})

describe('broadcast form', () => {
  it('starts with a fresh idempotency key and the all-customers audience', () => {
    const first: Record<string, never> = {}
    const second: Record<string, never> = {}
    broadcastFormExtension.initialize(first, null)
    broadcastFormExtension.initialize(second, null)
    expect(first).toMatchObject({ audience: 'all', type: 'info' })
    expect(first.idempotencyKey).not.toEqual(second.idempotencyKey)
  })

  it('turns comma-separated IDs into a unique list for the userIds audience', () => {
    expect(
      broadcastFormExtension.prepare({
        title: 'Hi',
        audience: 'userIds',
        userIdsText: '3, 4,3',
      }),
    ).toEqual({
      success: true,
      data: { title: 'Hi', audience: 'userIds', userIds: [3, 4] },
    })
    expect(
      broadcastFormExtension.prepare({ audience: 'userIds', userIdsText: 'x' }),
    ).toMatchObject({ success: false })
    expect(
      broadcastFormExtension.prepare({ audience: 'all', userIdsText: '9' }),
    ).toEqual({ success: true, data: { audience: 'all' } })
  })
})

describe('site content editor', () => {
  it('splits line-based settings into lists and saves through PUT', async () => {
    const values = portalContentFormSchema.parse({
      title: 'Cara klaim',
      summary: '',
      published: true,
      sections: [{ heading: 'Pilih', body: 'Filter kota.' }],
      data: { facts: 'Harga jelas.\n\n Kuota akurat. ' },
    })
    const input = contentFormToInput('home.claim-guide', values)
    expect(input.data).toEqual({ facts: ['Harga jelas.', 'Kuota akurat.'] })
    api.put.mockResolvedValue({})
    await savePortalContent('home.claim-guide', input)
    expect(api.put).toHaveBeenCalledWith(
      '/api/portal/admin/content/home.claim-guide',
      input,
    )
  })

  it('requires section text', () => {
    expect(
      portalContentFormSchema.safeParse({
        title: 'T',
        summary: '',
        published: false,
        sections: [{ heading: 'H', body: ' ' }],
        data: {},
      }).success,
    ).toBe(false)
  })
})
