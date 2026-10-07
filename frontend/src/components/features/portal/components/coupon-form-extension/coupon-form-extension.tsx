import { useWatch } from 'react-hook-form'
import type {
  PortalFormExtension,
  PortalFormValues,
} from '@/components/features/portal/lib/form-extension'
import type { CouponPackageInput } from '@/types/portal'
import type { Control } from 'react-hook-form'
import { CouponEditor } from '@/components/features/portal/components/coupon-editor'
import { couponEditorSchema } from '@/lib/schemas/coupon-editor'

const remaining = (item: CouponPackageInput) =>
  Math.max(0, item.stockTotal - (item.issuedStock ?? 0))

function CouponSummary({ control }: { control: Control<PortalFormValues> }) {
  const packages = (useWatch({ control, name: 'packages' }) ??
    []) as Array<CouponPackageInput>
  const images = (useWatch({ control, name: 'images' }) ?? []) as Array<{
    url: string
    alt: string
  }>
  const active = packages.filter((item) => item.active)
  const available = active.filter((item) => remaining(item) > 0)
  const starting = [...(available.length ? available : active)].sort(
    (a, b) => a.price - b.price,
  )[0]
  return (
    <section className="col-span-full grid gap-2 rounded-xl border border-default-200 p-4">
      <h3 className="font-semibold">Coupon summary</h3>
      <p>
        Starting price: Rp {(starting?.price ?? 0).toLocaleString('id-ID')}
        {starting?.oldPrice && starting.oldPrice > starting.price
          ? ` · Discount: ${Math.round((1 - starting.price / starting.oldPrice) * 100)}%`
          : ''}
      </p>
      <p>
        Total stock: {active.reduce((sum, item) => sum + item.stockTotal, 0)} ·
        Remaining stock:{' '}
        {active.reduce((sum, item) => sum + remaining(item), 0)}
      </p>
      <p className="break-all text-sm">
        Cover: {images.find((item) => item.url.trim())?.url || 'No photo'}
      </p>
    </section>
  )
}

export const couponFormExtension: PortalFormExtension = {
  initialize(values, entity) {
    values.images =
      Array.isArray(entity?.images) && entity.images.length
        ? entity.images
        : [
            {
              url: String(entity?.imageUrl ?? ''),
              alt: String(entity?.title ?? ''),
            },
          ]
    const packages =
      Array.isArray(entity?.packages) && entity.packages.length
        ? [...(entity.packages as Array<CouponPackageInput>)].sort(
            (a, b) => (a.position ?? 0) - (b.position ?? 0),
          )
        : [
            {
              name: String(entity?.title ?? ''),
              benefits: String(entity?.benefits ?? ''),
              price: Number(entity?.price ?? 0),
              oldPrice: entity?.oldPrice ? Number(entity.oldPrice) : null,
              stockTotal: Number(entity?.stockTotal ?? 0),
              active: true,
            },
          ]
    values.packages = packages.map((item) => ({
      ...item,
      issuedStock: item.stockTotal - (item.stockRemaining ?? item.stockTotal),
    }))
    if (!entity) values.active = true
  },
  prepare(values) {
    const parsed = couponEditorSchema.safeParse(values)
    if (!parsed.success)
      return { success: false, message: parsed.error.issues[0].message }
    const { images, packages } = parsed.data
    const active = packages.filter((item) => item.active)
    const cheapest = [...active].sort((a, b) => a.price - b.price)[0]
    return {
      success: true,
      data: {
        ...values,
        images,
        packages,
        imageUrl: images[0].url,
        price: cheapest?.price ?? 0,
        oldPrice: cheapest?.oldPrice ?? null,
        stockTotal: active.reduce((total, item) => total + item.stockTotal, 0),
        stockRemaining: active.reduce(
          (total, item) => total + item.stockTotal,
          0,
        ),
      },
    }
  },
  fields: (fields) =>
    fields
      .filter((field) => !field.readOnly)
      .sort(
        (a, b) =>
          (a.key === 'expiresAt' ? 1 : a.key === 'active' ? 2 : 0) -
          (b.key === 'expiresAt' ? 1 : b.key === 'active' ? 2 : 0),
      ),
  beforeField: (key, control, readOnly, onBusyChange) =>
    key === 'description' ? (
      <>
        <CouponEditor
          control={control}
          readOnly={readOnly}
          onBusyChange={onBusyChange}
        />
        <CouponSummary control={control} />
      </>
    ) : null,
  details: (control) => <CouponEditor control={control} readOnly />,
  booleanClassName:
    'col-span-full rounded-xl border border-default-200 bg-default-50 p-4',
  inputClassName: (key) => (key === 'expiresAt' ? 'col-span-full' : undefined),
}
