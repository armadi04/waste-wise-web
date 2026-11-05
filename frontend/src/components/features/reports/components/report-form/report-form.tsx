import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, MapPin, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { Report } from '@/types/api'
import type { ReportFormValues } from '@/lib/schemas/reports'
import { Button, Input, Textarea } from '@/components/shared/controls'
import {
  REPORT_IMAGE_MAX_BYTES,
  REPORT_IMAGE_MIME_TYPES,
  REPORT_STATUS_LABEL,
} from '@/lib/constants/reports'
import { reportFormSchema } from '@/lib/schemas/reports'
import { formatDateTime } from '@/lib/utils/format'

interface ReportFormProps {
  mode: 'create' | 'edit'
  report?: Report
  isSubmitting?: boolean
  onSubmit: (values: ReportFormValues, photo?: File) => Promise<void>
  onCancel?: () => void
}

export function ReportForm({
  mode,
  report,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: ReportFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      description: report?.description ?? '',
      latitude: report?.latitude ?? undefined,
      longitude: report?.longitude ?? undefined,
    },
  })
  const [photo, setPhoto] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

  useEffect(() => {
    reset({
      description: report?.description ?? '',
      latitude: report?.latitude ?? undefined,
      longitude: report?.longitude ?? undefined,
    })
    setPhoto(null)
    setPhotoError(null)
  }, [report, reset])

  const previewUrl = useMemo(
    () => (photo ? URL.createObjectURL(photo) : report?.media?.url ?? null),
    [photo, report?.media?.url],
  )

  useEffect(
    () => () => {
      if (photo && previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [photo, previewUrl],
  )

  const handlePhoto = (file: File | undefined) => {
    if (!file) {
      setPhoto(null)
      setPhotoError(null)
      return
    }
    if (
      !(REPORT_IMAGE_MIME_TYPES as ReadonlyArray<string>).includes(file.type)
    ) {
      setPhotoError('Photo must be JPEG, PNG, or WebP')
      setPhoto(null)
      return
    }
    if (file.size > REPORT_IMAGE_MAX_BYTES) {
      setPhotoError('Photo must be 5 MB or smaller')
      setPhoto(null)
      return
    }
    setPhotoError(null)
    setPhoto(file)
  }

  const submit = handleSubmit(async (values) => {
    if (mode === 'create' && !photo) {
      setPhotoError('Photo is required for a new report')
      return
    }
    await onSubmit(values, photo ?? undefined)
  })

  const aiSucceeded =
    report?.classificationStatus === 'COMPLETED' &&
    report?.predictedCategory !== null

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <Textarea
        label="Description"
        placeholder="Describe the waste condition and where it was found"
        isRequired
        minRows={4}
        {...register('description')}
        isInvalid={Boolean(errors.description)}
        errorMessage={errors.description?.message}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">
          Photo {mode === 'create' && <span className="text-danger">*</span>}
        </span>
        {previewUrl ? (
          <div className="relative w-full overflow-hidden rounded-large border border-default-200 bg-default-100">
            <img
              src={previewUrl}
              alt="Report photo preview"
              className="max-h-80 w-full object-contain"
            />
            {photo && (
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                color="danger"
                aria-label="Remove selected photo"
                className="absolute right-2 top-2"
                onPress={() => handlePhoto(undefined)}
              >
                <X size={16} />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-large border border-dashed border-default-300 p-8 text-center text-sm text-default-500">
            <ImagePlus size={28} />
            <span>Select a JPEG, PNG, or WebP image (max 5 MB)</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={REPORT_IMAGE_MIME_TYPES.join(',')}
          className="sr-only"
          onChange={(event) => {
            handlePhoto(event.target.files?.[0] ?? undefined)
            event.currentTarget.value = ''
          }}
        />
        <Button
          type="button"
          variant="bordered"
          className="self-start"
          onPress={() => fileInputRef.current?.click()}
        >
          {photo || previewUrl ? 'Choose a different photo' : 'Choose photo'}
        </Button>
        {photoError && (
          <p role="alert" className="text-sm text-danger">
            {photoError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Latitude"
          type="number"
          step="any"
          placeholder="-6.200000"
          startContent={<MapPin size={15} />}
          {...register('latitude', {
            setValueAs: (value) =>
              value === '' || value === null || value === undefined
                ? undefined
                : Number(value),
          })}
          isInvalid={Boolean(errors.latitude)}
          errorMessage={errors.latitude?.message}
        />
        <Input
          label="Longitude"
          type="number"
          step="any"
          placeholder="106.816666"
          startContent={<MapPin size={15} />}
          {...register('longitude', {
            setValueAs: (value) =>
              value === '' || value === null || value === undefined
                ? undefined
                : Number(value),
          })}
          isInvalid={Boolean(errors.longitude)}
          errorMessage={errors.longitude?.message}
        />
      </div>

      {report && (
        <div className="rounded-large bg-default-100 p-4 text-sm text-default-600">
          <p>
            Current status:{' '}
            <span className="font-medium text-foreground">
              {REPORT_STATUS_LABEL[report.status]}
            </span>
          </p>
          {aiSucceeded ? (
            <p className="mt-2">
              Save a new photo to run AI classification again. Current result:
              category and {(Number(report.confidence) * 100).toFixed(1)}%
              confidence.
            </p>
          ) : (
            <p className="mt-2">
              AI classification has not produced a result for the current photo.
            </p>
          )}
          <p className="mt-2 text-xs text-default-500">
            Last updated {formatDateTime(report.updatedAt)}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="light" onPress={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" color="primary" isLoading={isSubmitting}>
          {mode === 'create' ? 'Create report' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
