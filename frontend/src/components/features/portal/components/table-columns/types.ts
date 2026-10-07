import type {
  PortalField,
  PortalResourceConfig,
} from '@/components/features/portal/lib/config'
import type { PortalRecord } from '@/types/portal'

export interface PortalColumnOptions {
  config: PortalResourceConfig
  fields: Array<PortalField>
  onView: (record: PortalRecord) => void
  onEdit: (record: PortalRecord) => void
  onDelete: (id: number) => void
  hasPermission: (permission: string) => boolean
  onRejectRefund?: (record: PortalRecord) => void
  onApproveRefund?: (record: PortalRecord) => void
  approvingRefund?: boolean
  onManageRelation?: (record: PortalRecord) => void
  onVerifyPass?: (record: PortalRecord) => void
  verifyingPass?: boolean
  onAdjustPoints?: (record: PortalRecord) => void
  onRevokeGift?: (record: PortalRecord) => void
  onAdjustWallet?: (record: PortalRecord) => void
  onOpenCustomer?: (record: PortalRecord) => void
}
