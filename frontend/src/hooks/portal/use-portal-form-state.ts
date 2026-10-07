import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import type {
  PortalFormModalProps,
  PortalFormValues,
} from '@/components/features/portal/modal/portal-form-modal/types'
import type { PortalValue } from '@/types/portal'
import { broadcastFormExtension } from '@/components/features/portal/components/broadcast-form-extension/broadcast-form-extension'
import { campaignFormExtension } from '@/components/features/portal/components/campaign-form-extension/campaign-form-extension'
import { couponFormExtension } from '@/components/features/portal/components/coupon-form-extension/coupon-form-extension'
import { inputValue } from '@/components/features/portal/modal/portal-form-modal/lib/portal-form-modal-helpers'
import { useTimeZone } from '@/lib/stores/time-zone'
import {
  BUSINESS_TIME_ZONE,
  toBusinessDateInput,
} from '@/lib/utils/business-time'

export function usePortalFormState({
  isOpen,
  config,
  fields,
  entity,
}: PortalFormModalProps) {
  useTimeZone((s) => s.timeZone)

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<PortalFormValues>()

  const businessSchedule =
    config.resource === 'coupons' || config.resource === 'events'

  const timeZone = String(
    watch('timeZone') ||
      entity?.timeZone ||
      (businessSchedule ? BUSINESS_TIME_ZONE : 'UTC'),
  )

  const [isConverting, setIsConverting] = useState(false)

  const zoneChanged = Boolean(
    entity &&
    businessSchedule &&
    timeZone !== String(entity.timeZone ?? BUSINESS_TIME_ZONE),
  )

  const changeMode = watch('timeZoneChangeMode')

  useEffect(() => {
    if (!entity || !businessSchedule || changeMode !== 'preserveInstant') return
    for (const field of fields.filter((item) => item.type === 'datetime'))
      if (entity[field.key])
        setValue(
          field.key,
          toBusinessDateInput(String(entity[field.key]), timeZone),
        )
  }, [entity, businessSchedule, changeMode, fields, setValue, timeZone])

  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false)

  const [isSlugEdited, setIsSlugEdited] = useState(false)

  const title = watch('title')

  const extension =
    config.resource === 'coupons'
      ? couponFormExtension
      : config.resource === 'campaigns'
        ? campaignFormExtension
        : config.resource === 'broadcasts'
          ? broadcastFormExtension
          : undefined

  const slugField = fields.find((field) => field.autoSlug)

  const autoSlug = !entity && slugField?.autoSlug

  const slugify = (value: PortalValue | undefined) =>
    String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 160)

  useEffect(() => {
    if (!isOpen) return
    const values: PortalFormValues = {}
    for (const field of fields) {
      values[field.key] = inputValue(
        field,
        entity ? entity[field.key] : field.createDefault,
        String(
          entity?.timeZone ?? (businessSchedule ? BUSINESS_TIME_ZONE : 'UTC'),
        ),
      )
    }
    if (businessSchedule)
      values.timeZone = String(entity?.timeZone ?? BUSINESS_TIME_ZONE)
    values.timeZoneChangeMode = ''
    values.timeZoneChangeReason = ''
    extension?.initialize(values, entity)
    reset(values)
    setIsSlugEdited(false)
  }, [businessSchedule, extension, entity, fields, isOpen, reset])

  useEffect(() => {
    if (!autoSlug || isSlugEdited || !slugField) return
    setValue(slugField.key, slugify(title))
  }, [autoSlug, isSlugEdited, setValue, slugField, title])
  return {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    errors,
    businessSchedule,
    timeZone,
    isConverting,
    setIsConverting,
    zoneChanged,
    isUploadingPhotos,
    setIsUploadingPhotos,
    isSlugEdited,
    setIsSlugEdited,
    extension,
    slugField,
    autoSlug,
  }
}
