import type { DataField } from '@/components/features/portal/components/content-editor/types'
import type { PortalContentFormValues } from '@/lib/schemas/portal'
import type {
  PortalContent,
  SavePortalContentInput,
} from '@/lib/services/portal.service'

/** Key-specific settings, mirroring the backend content registry. */
export const CONTENT_DATA_FIELDS: Record<string, Array<DataField>> = {
  'page.night-work': [
    {
      name: 'externalUrl',
      label: 'Job board URL',
      kind: 'text',
      description:
        'https:// link opened by the page button. Leave empty to hide the button.',
    },
    { name: 'ctaLabel', label: 'Button label', kind: 'text' },
  ],
  'home.claim-guide': [
    {
      name: 'facts',
      label: 'Trust facts (one per line, up to 6)',
      kind: 'lines',
    },
  ],
  'help.contact': [
    { name: 'email', label: 'Support email', kind: 'text' },
    {
      name: 'whatsapp',
      label: 'WhatsApp number',
      kind: 'text',
      description: 'International format, e.g. +6281234567890.',
    },
    { name: 'hours', label: 'Support hours', kind: 'text' },
  ],
  'status.notice': [
    {
      name: 'level',
      label: 'Notice level',
      kind: 'select',
      options: ['info', 'warning', 'critical'],
    },
  ],
}

export const toForm = (entry: PortalContent): PortalContentFormValues => {
  const data: Record<string, unknown> = { ...entry.data }
  for (const field of CONTENT_DATA_FIELDS[entry.key] ?? [])
    if (field.kind === 'lines')
      data[field.name] = (
        Array.isArray(data[field.name])
          ? (data[field.name] as Array<string>)
          : []
      ).join('\n')
  return {
    title: entry.title,
    summary: entry.summary,
    sections: entry.sections.map((section) => ({
      id: section.id,
      heading: section.heading ?? '',
      body: section.body,
    })),
    data,
    published: entry.published,
  }
}

export const contentFormToInput = (
  key: string,
  values: PortalContentFormValues,
): SavePortalContentInput => {
  const data: Record<string, unknown> = { ...values.data }
  for (const field of CONTENT_DATA_FIELDS[key] ?? [])
    if (field.kind === 'lines')
      data[field.name] = String(data[field.name] ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
  // OpenAPI types `data` as an empty object; the registry defines its keys.
  return { ...values, data: data as SavePortalContentInput['data'] }
}
