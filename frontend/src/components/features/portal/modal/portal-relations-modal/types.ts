export type RelationKind = 'event-tickets' | 'order-items'

export interface PortalRelationsModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  kind: RelationKind | null
  ownerId: number | null
  ownerPaid: boolean
}
