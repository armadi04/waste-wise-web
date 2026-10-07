import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Switch,
  Textarea,
} from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useFieldArray, useForm } from 'react-hook-form'
import type {
  PortalContent,
  SavePortalContentInput,
} from '@/lib/services/portal.service'
import type { PortalContentFormValues } from '@/lib/schemas/portal'
import { formatDateTime } from '@/lib/utils/format'
import { portalContentFormSchema } from '@/lib/schemas/portal'
import {
  CONTENT_DATA_FIELDS,
  contentFormToInput,
  toForm,
} from '@/components/features/portal/components/content-editor/lib/content-editor-helpers'

export function ContentEditor({
  entry,
  canUpdate,
  busy,
  onSave,
}: {
  entry: PortalContent
  canUpdate: boolean
  busy: boolean
  onSave: (data: SavePortalContentInput) => void
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PortalContentFormValues>({
    resolver: zodResolver(portalContentFormSchema),
    defaultValues: toForm(entry),
  })
  const sections = useFieldArray({ control, name: 'sections' })
  useEffect(() => {
    reset(toForm(entry))
  }, [entry, reset])
  const readOnly = !canUpdate || busy
  const dataFields = CONTENT_DATA_FIELDS[entry.key] ?? []

  return (
    <Card className="border border-default-100">
      <CardBody>
        <form
          className="grid gap-4"
          onSubmit={handleSubmit((values) =>
            onSave(contentFormToInput(entry.key, values)),
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{entry.key}</h2>
            <Chip
              size="sm"
              color={entry.published ? 'success' : 'default'}
              variant="flat"
            >
              {entry.published
                ? 'Published'
                : entry.saved
                  ? 'Draft'
                  : 'Not set — portal shows built-in copy'}
            </Chip>
            {entry.saved && (
              <span className="text-xs text-default-500">
                Updated {formatDateTime(String(entry.updatedAt))}
              </span>
            )}
          </div>
          <p className="text-sm text-default-500">{entry.description}</p>
          <Input
            {...register('title')}
            label="Title"
            labelPlacement="outside"
            variant="bordered"
            isRequired
            isReadOnly={readOnly}
            isInvalid={Boolean(errors.title)}
            errorMessage={errors.title?.message}
          />
          <Textarea
            {...register('summary')}
            label={entry.key === 'status.notice' ? 'Notice message' : 'Summary'}
            labelPlacement="outside"
            variant="bordered"
            minRows={2}
            isReadOnly={readOnly}
          />
          {dataFields.map((field) =>
            field.kind === 'select' ? (
              <label key={field.name} className="block text-sm">
                {field.label}
                <select
                  {...register(`data.${field.name}`)}
                  disabled={readOnly}
                  className="mt-2 w-full rounded-lg border border-default-300 bg-default-50 p-3"
                >
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ) : field.kind === 'lines' ? (
              <Textarea
                key={field.name}
                {...register(`data.${field.name}`)}
                label={field.label}
                labelPlacement="outside"
                variant="bordered"
                minRows={3}
                isReadOnly={readOnly}
              />
            ) : (
              <Input
                key={field.name}
                {...register(`data.${field.name}`)}
                label={field.label}
                labelPlacement="outside"
                variant="bordered"
                description={field.description}
                isReadOnly={readOnly}
              />
            ),
          )}
          {entry.maxSections > 0 && (
            <section className="grid gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Sections{' '}
                  <span className="text-sm font-normal text-default-500">
                    ({sections.fields.length}/{entry.maxSections}) · plain text,
                    blank line between paragraphs
                  </span>
                </h3>
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<Plus size={16} />}
                  isDisabled={
                    readOnly || sections.fields.length >= entry.maxSections
                  }
                  onPress={() => sections.append({ heading: '', body: '' })}
                >
                  Add section
                </Button>
              </div>
              {sections.fields.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-2 rounded-xl border border-default-200 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      {...register(`sections.${index}.heading`)}
                      aria-label={`Section ${index + 1} heading`}
                      placeholder={
                        entry.sectionHeading === 'required'
                          ? 'Heading'
                          : 'Heading (optional)'
                      }
                      variant="bordered"
                      isRequired={entry.sectionHeading === 'required'}
                      isReadOnly={readOnly}
                    />
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      aria-label="Move up"
                      isDisabled={readOnly || index === 0}
                      onPress={() => sections.move(index, index - 1)}
                    >
                      <ArrowUp size={16} />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      aria-label="Move down"
                      isDisabled={
                        readOnly || index === sections.fields.length - 1
                      }
                      onPress={() => sections.move(index, index + 1)}
                    >
                      <ArrowDown size={16} />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      aria-label="Remove section"
                      isDisabled={readOnly}
                      onPress={() => sections.remove(index)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <Textarea
                    {...register(`sections.${index}.body`)}
                    aria-label={`Section ${index + 1} text`}
                    variant="bordered"
                    minRows={3}
                    isReadOnly={readOnly}
                    isInvalid={Boolean(errors.sections?.[index]?.body)}
                    errorMessage={errors.sections?.[index]?.body?.message}
                  />
                </div>
              ))}
            </section>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-default-100 pt-4">
            <Controller
              name="published"
              control={control}
              render={({ field }) => (
                <Switch
                  isSelected={field.value}
                  onValueChange={field.onChange}
                  isDisabled={readOnly}
                >
                  Published on the portal
                </Switch>
              )}
            />
            {canUpdate && (
              <Button type="submit" color="primary" isLoading={busy}>
                Save
              </Button>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
