import { Controller } from 'react-hook-form'
import type {
  CouponGalleryImage,
  CouponPackageInput,
  PortalValue,
} from '@/types/portal'
import type { Control } from 'react-hook-form'
import { GalleryEditor } from '@/components/features/portal/components/coupon-editor/child/gallery-editor'

import { PackagesEditor } from '@/components/features/portal/components/coupon-editor/child/packages-editor'

export function CouponEditor({
  control,
  readOnly,
  onBusyChange,
}: {
  control: Control<Record<string, PortalValue>>
  readOnly: boolean
  onBusyChange?: (busy: boolean) => void
}) {
  return (
    <>
      <Controller
        name="images"
        control={control}
        render={({ field }) => (
          <GalleryEditor
            onBusyChange={onBusyChange}
            value={(field.value ?? []) as Array<CouponGalleryImage>}
            onChange={field.onChange}
            readOnly={readOnly}
          />
        )}
      />
      <Controller
        name="packages"
        control={control}
        render={({ field }) => (
          <PackagesEditor
            value={(field.value ?? []) as Array<CouponPackageInput>}
            onChange={field.onChange}
            readOnly={readOnly}
          />
        )}
      />
    </>
  )
}
