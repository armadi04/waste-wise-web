import { describe, expect, it } from 'vitest'
import { couponEditorSchema } from '@/lib/schemas/coupon-editor'

const photo = { url: 'https://example.test/photo.jpg', alt: 'Photo' }
const packages = [
  {
    name: 'Dinner',
    benefits: 'Meal',
    price: 10,
    oldPrice: null,
    stockTotal: 5,
    active: true,
  },
]
describe('coupon photo draft validation', () => {
  it('accepts 10 photos and rejects 11', () => {
    expect(
      couponEditorSchema.safeParse({ images: Array(10).fill(photo), packages })
        .success,
    ).toBe(true)
    expect(
      couponEditorSchema.safeParse({ images: Array(11).fill(photo), packages })
        .success,
    ).toBe(false)
  })
  it('ignores empty slots but rejects a nonempty invalid URL', () => {
    expect(
      couponEditorSchema.parse({
        images: [{ url: '', alt: '' }, photo],
        packages,
      }).images,
    ).toHaveLength(1)
    expect(
      couponEditorSchema.safeParse({
        images: [{ url: 'invalid', alt: '' }, photo],
        packages,
      }).success,
    ).toBe(false)
    expect(
      couponEditorSchema.safeParse({ images: [{ url: '', alt: '' }], packages })
        .success,
    ).toBe(false)
  })
})
