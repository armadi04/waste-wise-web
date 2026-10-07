import type { PortalFormExtension } from '@/components/features/portal/lib/form-extension'

/** Converts the comma-separated ID field and adds a per-open idempotency key. */
export const broadcastFormExtension: PortalFormExtension = {
  initialize(values) {
    values.type = 'info'
    values.audience = 'all'
    values.userIdsText = ''
    values.idempotencyKey = crypto.randomUUID()
  },
  prepare(values) {
    const { userIdsText, ...data } = values
    if (data.audience !== 'userIds') return { success: true as const, data }
    const parts = String(userIdsText ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const ids = parts.map(Number)
    if (!ids.length || ids.some((id) => !Number.isInteger(id) || id < 1))
      return {
        success: false as const,
        message: 'Enter comma-separated customer IDs for this audience.',
      }
    return {
      success: true as const,
      data: { ...data, userIds: [...new Set(ids)] },
    }
  },
  fields: (fields) => fields.filter((field) => !field.readOnly),
  beforeField: () => null,
  details: () => null,
  booleanClassName: 'self-end pb-2',
  inputClassName: () => undefined,
}
