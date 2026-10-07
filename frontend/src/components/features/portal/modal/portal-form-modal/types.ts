import type {
  PortalField,
  PortalResourceConfig,
} from '@/components/features/portal/lib/config'
import type { PortalRecord, PortalValue } from '@/types/portal'

export interface PortalFormModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  config: PortalResourceConfig
  fields: Array<PortalField>
  entity: PortalRecord | null
  isReadOnly: boolean
  isLoading?: boolean
  onSubmit: (data: Record<string, PortalValue>) => void
}

export type PortalFormValues = Record<string, PortalValue>
