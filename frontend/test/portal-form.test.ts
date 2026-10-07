import { describe, expect, it } from 'vitest'
import { portalResourceConfig } from '@/components/features/portal/lib/config'
import {
  changedFormData,
  normalizeFormData,
  preparePortalMutation,
} from '@/lib/utils/portal-form'

describe('portal mutation payloads', () => {
  it('retains coupon summaries on create but omits them on update', () => {
    const fields = portalResourceConfig('coupons')!.fields
    const data = {
      price: 10000,
      oldPrice: 12000,
      stockTotal: 5,
      stockRemaining: 5,
      imageUrl: '/cover.jpg',
      packages: [],
      images: [],
    }
    expect(normalizeFormData(data, fields, 'create')).toMatchObject(data)
    const update = normalizeFormData(data, fields)
    for (const key of [
      'price',
      'oldPrice',
      'stockTotal',
      'stockRemaining',
      'imageUrl',
    ])
      expect(update).not.toHaveProperty(key)
  })
  it.each(['vouchers', 'tickets'])(
    'creates %s as Issued without usage fields',
    (resource) => {
      const fields = portalResourceConfig(resource)!.fields
      const result = normalizeFormData(
        {
          status: 'Redeemed',
          redeemedAt: '2026-10-01T00:00:00Z',
          checkedInAt: '2026-10-01T00:00:00Z',
        },
        fields,
        'create',
      )
      expect(result.status).toBe('Issued')
      expect(result).not.toHaveProperty('redeemedAt')
      expect(result).not.toHaveProperty('checkedInAt')
    },
  )
  it('sends only changed normalized values including equivalent dates', () => {
    const fields = portalResourceConfig('vouchers')!.fields
    const original = normalizeFormData(
      {
        userId: 7,
        couponId: 9,
        code: 'V1',
        imageUrl: '/old.jpg',
        expiresAt: '2027-01-01T00:00:00Z',
      },
      fields,
    )
    const data = normalizeFormData(
      {
        ...original,
        userId: '7',
        imageUrl: '/new.jpg',
        expiresAt: '2027-01-01T07:00:00+07:00',
      },
      fields,
    )
    expect(changedFormData(data, original, fields)).toEqual({
      imageUrl: '/new.jpg',
    })
  })
})

describe('resource-specific update contracts', () => {
  it('preserves null and sends nullable field clearing', () => {
    const config = portalResourceConfig('coupons')!
    expect(
      preparePortalMutation(
        { maxPerUser: null, validityDays: '', maxPerOrder: undefined },
        config,
        'update',
      ),
    ).toMatchObject({ maxPerUser: null, validityDays: null })
    expect(
      preparePortalMutation({ maxPerOrder: undefined }, config, 'update'),
    ).not.toHaveProperty('maxPerOrder')
  })
  it('preserves full coupon schedule, packages and images on metadata edits', () => {
    const config = portalResourceConfig('coupons')!
    const data = {
      title: 'Changed',
      timeZone: 'Asia/Makassar',
      localTimes: { expiresAt: '2027-01-01T08:00:00' },
      timeZoneChangeMode: 'preserveLocal',
      timeZoneChangeReason: 'Venue moved',
      packages: [
        {
          name: 'Dinner',
          benefits: 'Meal',
          price: 1000,
          oldPrice: null,
          stockTotal: 10,
          active: true,
        },
      ],
      images: [{ url: '/photo.jpg', alt: 'Coupon' }],
    }
    expect(
      preparePortalMutation(data, config, 'update', {
        ...data,
        title: 'Original',
      }),
    ).toEqual(data)
  })
  it('preserves campaign rules when toggling active', () => {
    const config = portalResourceConfig('campaigns')!
    const rules = { paymentPoints: 10 }
    const result = preparePortalMutation(
      { rules, targetPoints: 100, active: false },
      config,
      'update',
      { rules, targetPoints: 100, active: true },
    )
    expect(result).toEqual({ rules, targetPoints: 100, active: false })
  })
  it('only pass resources opt into changed-field updates', () => {
    for (const resource of [
      'vouchers',
      'tickets',
      'events',
      'coupons',
      'campaigns',
      'bundles',
      'bookings',
      'promo-codes',
    ]) {
      const config = portalResourceConfig(resource)!
      expect(config.partialUpdate === true).toBe(
        ['vouchers', 'tickets'].includes(resource),
      )
    }
    const config = portalResourceConfig('vouchers')!
    expect(
      preparePortalMutation(
        { userId: 7, couponId: 9, imageUrl: '/new.jpg' },
        config,
        'update',
        { userId: 7, couponId: 9, imageUrl: '/old.jpg' },
      ),
    ).toEqual({ imageUrl: '/new.jpg' })
  })
})
