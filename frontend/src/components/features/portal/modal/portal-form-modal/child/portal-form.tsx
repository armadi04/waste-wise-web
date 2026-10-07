import { Checkbox, Input, Textarea } from '@heroui/react'
import { Controller } from 'react-hook-form'
import type { PortalFormModalProps } from '@/components/features/portal/modal/portal-form-modal/types'
import type { usePortalFormState } from '@/hooks/portal/use-portal-form-state'
import { BundleComponents } from '@/components/features/portal/components/bundle-components'
import { LookupSelect } from '@/components/features/portal/components/lookup-select'
import { TimePreview } from '@/components/features/portal/components/time-preview'
import { inputType } from '@/components/features/portal/modal/portal-form-modal/lib/portal-form-modal-helpers'
import { previewLocalTime } from '@/lib/services/time-zone.service'
import {
  BUSINESS_TIME_ZONES,
  businessDateInputToISO,
  timeZoneLabel,
} from '@/lib/utils/business-time'

type Props = Pick<
  ReturnType<typeof usePortalFormState>,
  | 'handleSubmit'
  | 'autoSlug'
  | 'isSlugEdited'
  | 'slugField'
  | 'extension'
  | 'zoneChanged'
  | 'setError'
  | 'setIsConverting'
  | 'businessSchedule'
  | 'timeZone'
  | 'register'
  | 'control'
  | 'setValue'
  | 'watch'
  | 'errors'
  | 'setIsSlugEdited'
  | 'setIsUploadingPhotos'
> &
  Pick<
    PortalFormModalProps,
    'config' | 'fields' | 'entity' | 'isLoading' | 'onSubmit'
  >

export function PortalForm({
  handleSubmit,
  autoSlug,
  isSlugEdited,
  slugField,
  extension,
  zoneChanged,
  setError,
  setIsConverting,
  businessSchedule,
  timeZone,
  register,
  control,
  setValue,
  watch,
  errors,
  setIsSlugEdited,
  setIsUploadingPhotos,
  config,
  fields,
  entity,
  isLoading = false,
  onSubmit,
}: Props) {
  return (
    <form
      id="portal-form"
      onSubmit={handleSubmit(async (data) => {
        if (autoSlug && !isSlugEdited && slugField) delete data[slugField.key]
        const prepared = extension?.prepare(data)
        if (prepared && !prepared.success) {
          setError('root', { message: prepared.message })
          return
        }
        const output = {
          ...(prepared?.success ? prepared.data : data),
        }
        if (
          zoneChanged &&
          (!data.timeZoneChangeMode ||
            !String(data.timeZoneChangeReason).trim())
        ) {
          setError('root', {
            message: 'Choose how to change the timezone and provide a reason.',
          })
          return
        }
        setIsConverting(true)
        try {
          const localTimes: Record<string, string> = {}
          for (const field of fields.filter(
            (field) => field.type === 'datetime',
          )) {
            const local = String(data[field.key] ?? '')
            if (!local) continue
            if (businessSchedule) {
              if (!(
                zoneChanged && data.timeZoneChangeMode === 'preserveInstant'
              ))
                await previewLocalTime(local, timeZone)
              localTimes[field.key] = local
              delete output[field.key]
            } else output[field.key] = businessDateInputToISO(local, timeZone)
          }
          if (businessSchedule) output.localTimes = localTimes
          if (zoneChanged) {
            output.timeZoneChangeMode = data.timeZoneChangeMode
            output.timeZoneChangeReason = data.timeZoneChangeReason
          } else {
            delete output.timeZoneChangeMode
            delete output.timeZoneChangeReason
          }
          onSubmit(output)
        } catch (error) {
          setError('root', {
            message:
              error instanceof Error
                ? error.message
                : 'Timezone conversion failed.',
          })
        } finally {
          setIsConverting(false)
        }
      })}
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
    >
      {errors.root?.message && (
        <p role="alert" className="col-span-full text-sm text-danger">
          {errors.root.message}
        </p>
      )}
      {zoneChanged && (
        <section className="col-span-full grid gap-3 rounded-xl border border-warning-300 p-4">
          <label>
            Timezone change behavior
            <select
              {...register('timeZoneChangeMode')}
              className="mt-2 w-full rounded-lg border border-default-300 bg-default-50 p-3"
              required
            >
              <option value="">Choose behavior</option>
              <option value="preserveInstant">
                Preserve instant — local time changes
              </option>
              <option value="preserveLocal">
                Preserve local time — UTC changes
              </option>
            </select>
          </label>
          <Input
            {...register('timeZoneChangeReason')}
            label="Reason for timezone change"
            isRequired
          />
        </section>
      )}
      {config.resource === 'bundles' && (
        <BundleComponents
          control={control}
          register={register}
          setValue={setValue}
          needsReview={Boolean(entity?.componentsNeedReview)}
        />
      )}
      {(extension?.fields(fields) ?? fields)
        .filter(
          (field) =>
            config.resource !== 'bundles' ||
            !['packageId', 'ticketTypeId'].includes(field.key),
        )
        .map((field) => {
          if (field.type === 'timezone')
            return (
              <label key={field.key} className="block text-sm">
                {field.label}
                <select
                  {...register(field.key)}
                  value={timeZone}
                  onChange={(event) => setValue(field.key, event.target.value)}
                  className="mt-2 w-full rounded-lg border border-default-300 bg-default-50 p-3"
                >
                  {BUSINESS_TIME_ZONES.map((zone) => (
                    <option key={zone} value={zone}>
                      {timeZoneLabel(zone)} — {zone}
                    </option>
                  ))}
                </select>
              </label>
            )
          if (field.type === 'lookup')
            return (
              <LookupSelect
                key={field.key}
                field={field}
                registration={register(field.key, {
                  required: field.required,
                })}
                current={String(entity?.[field.key] ?? '')}
              />
            )
          if (field.type === 'select')
            return (
              <label key={field.key} className="block text-sm">
                {field.label}
                <select
                  {...register(field.key, {
                    required: field.required,
                  })}
                  className="mt-2 w-full rounded-lg border border-default-300 bg-default-50 p-3"
                >
                  {!field.required && <option value="">—</option>}
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            )
          if (field.type === 'boolean') {
            return (
              <Controller
                key={field.key}
                name={field.key}
                control={control}
                defaultValue={false}
                render={({ field: controllerField }) => (
                  <div
                    className={extension?.booleanClassName ?? 'self-end pb-2'}
                  >
                    <Checkbox
                      isSelected={Boolean(controllerField.value)}
                      onValueChange={controllerField.onChange}
                    >
                      {field.label}
                    </Checkbox>
                  </div>
                )}
              />
            )
          }
          if (field.type === 'textarea') {
            return (
              <div key={field.key} className="contents">
                {extension?.beforeField(
                  field.key,
                  control,
                  isLoading,
                  setIsUploadingPhotos,
                )}
                <Textarea
                  key={field.key}
                  {...register(field.key)}
                  label={field.label}
                  labelPlacement="outside"
                  variant="bordered"
                  minRows={3}
                  isRequired={field.required}
                  className="md:col-span-2"
                />
              </div>
            )
          }
          const fieldRegistration = register(field.key)
          return (
            <div
              key={field.key}
              className={extension?.inputClassName(field.key)}
            >
              <Input
                key={field.key}
                {...fieldRegistration}
                value={
                  field.autoSlug || field.type === 'datetime'
                    ? String(watch(field.key) ?? '')
                    : undefined
                }
                onChange={(event) => {
                  if (field.autoSlug) setIsSlugEdited(true)
                  fieldRegistration.onChange(event)
                }}
                type={inputType(field)}
                step={field.type === 'datetime' ? '0.001' : undefined}
                className={extension?.inputClassName(field.key)}
                label={
                  field.type === 'datetime'
                    ? `${field.label} (${timeZoneLabel(timeZone)})`
                    : field.label
                }
                labelPlacement={
                  field.type === 'datetime' ? 'outside-top' : 'outside'
                }
                variant="bordered"
                isRequired={field.required}
                isReadOnly={field.readOnly}
                description={
                  field.autoSlug && !entity
                    ? 'Auto-generated from title. Edit to customize.'
                    : field.description
                }
              />
              {businessSchedule && field.type === 'datetime' && (
                <TimePreview
                  value={String(watch(field.key) ?? '')}
                  timeZone={timeZone}
                />
              )}
            </div>
          )
        })}
    </form>
  )
}
