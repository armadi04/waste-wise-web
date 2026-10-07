import type { PortalField } from '@/components/features/portal/lib/config'
import type { PortalRecord, PortalValue } from '@/types/portal'
import type { ReactNode } from 'react'
import type { Control } from 'react-hook-form'

export type PortalFormValues = Record<string, PortalValue>
export interface PortalFormExtension {
  initialize: (values: PortalFormValues, entity: PortalRecord | null) => void
  prepare: (
    values: PortalFormValues,
  ) =>
    | { success: true; data: PortalFormValues }
    | { success: false; message: string }
  fields: (fields: Array<PortalField>) => Array<PortalField>
  beforeField: (
    key: string,
    control: Control<PortalFormValues>,
    readOnly: boolean,
    onBusyChange: (busy: boolean) => void,
  ) => ReactNode
  details: (control: Control<PortalFormValues>) => ReactNode
  booleanClassName: string
  inputClassName: (key: string) => string | undefined
}
