import { useQuery } from '@tanstack/react-query'
import { useWatch } from 'react-hook-form'
import type { PortalFormValues } from '@/components/features/portal/lib/form-extension'
import type { Control, UseFormRegister, UseFormSetValue } from 'react-hook-form'
import { records } from '@/components/features/portal/components/bundle-components/lib/bundle-components-helpers'
import { useUserPermission } from '@/hooks/permissions'
import { portalBundleComponentQueryOptions } from '@/lib/query/options'

export function BundleComponents({
  control,
  register,
  setValue,
  needsReview,
}: {
  control: Control<PortalFormValues>
  register: UseFormRegister<PortalFormValues>
  setValue: UseFormSetValue<PortalFormValues>
  needsReview: boolean
}) {
  const couponSlug = String(useWatch({ control, name: 'couponSlug' }) ?? '')
  const eventSlug = String(useWatch({ control, name: 'eventSlug' }) ?? '')
  const packageId = useWatch({ control, name: 'packageId' })
  const ticketTypeId = useWatch({ control, name: 'ticketTypeId' })
  const { hasPermission } = useUserPermission()
  const coupons = useQuery({
    ...portalBundleComponentQueryOptions('coupons'),
    enabled: hasPermission('portal.coupons.read'),
  })
  const events = useQuery({
    ...portalBundleComponentQueryOptions('events'),
    enabled: hasPermission('portal.events.read'),
  })
  const tickets = useQuery({
    ...portalBundleComponentQueryOptions('event-tickets'),
    enabled: hasPermission('portal.event_tickets.read'),
  })
  const coupon = records(coupons.data).find((item) => item.slug === couponSlug)
  const event = records(events.data).find((item) => item.slug === eventSlug)
  const packages = records(coupon?.packages).filter((item) => item.active)
  const ticketOptions = records(tickets.data).filter(
    (item) => item.eventId === event?.id,
  )
  return (
    <section className="col-span-full grid gap-4 rounded-xl border border-default-200 p-4 md:grid-cols-2">
      <h3 className="col-span-full font-semibold">Bundle benefits per unit</h3>
      <p className="col-span-full text-sm text-default-500">
        Choose a package and ticket belonging to the parent coupon/event.
        Incomplete bundles cannot be purchased.
      </p>
      {needsReview && (
        <p
          role="alert"
          className="col-span-full rounded-lg border border-warning-300 bg-warning-50 p-3 text-sm text-warning-800"
        >
          Legacy component choices need review. Confirm the selected package and
          ticket, then save this bundle to make it purchasable.
        </p>
      )}
      <input
        type="hidden"
        {...register('packageId', {
          setValueAs: (value) => (value ? Number(value) : null),
        })}
      />
      <input
        type="hidden"
        {...register('ticketTypeId', {
          setValueAs: (value) => (value ? Number(value) : null),
        })}
      />
      <label className="text-sm">
        Coupon package
        <select
          className="mt-2 w-full rounded-lg border border-default-300 bg-default-50 p-3"
          value={String(packageId ?? '')}
          disabled={!hasPermission('portal.coupons.read') || coupons.isPending}
          onChange={(event) =>
            setValue('packageId', event.target.value || null)
          }
        >
          <option value="">Not configured</option>
          {packages.map((item) => (
            <option key={item.id} value={item.id}>
              {String(item.name)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Event ticket type
        <select
          className="mt-2 w-full rounded-lg border border-default-300 bg-default-50 p-3"
          value={String(ticketTypeId ?? '')}
          disabled={
            !hasPermission('portal.event_tickets.read') ||
            !hasPermission('portal.events.read') ||
            tickets.isPending
          }
          onChange={(event) =>
            setValue('ticketTypeId', event.target.value || null)
          }
        >
          <option value="">Not configured</option>
          {ticketOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {String(item.name)}
            </option>
          ))}
        </select>
      </label>
      {(coupons.isError || events.isError || tickets.isError) && (
        <p role="alert" className="col-span-full text-danger">
          Unable to load bundle components. Retry before saving.
        </p>
      )}
    </section>
  )
}
