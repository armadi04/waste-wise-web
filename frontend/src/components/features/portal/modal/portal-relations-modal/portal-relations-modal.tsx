import {
  Button,
  Card,
  CardBody,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { ListTree, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { PortalRelationsModalProps } from '@/components/features/portal/modal/portal-relations-modal/types'
import type { PortalRecord, PortalValue } from '@/types/portal'
import { portalResourceConfig } from '@/components/features/portal/lib/config'
import { portalModalClassNames } from '@/components/features/portal/lib/modal-styles'
import { PortalFormModal } from '@/components/features/portal/modal/portal-form-modal'
import { useAppMutation, useConfirmation } from '@/hooks/global'
import { useUserPermission } from '@/hooks/permissions'
import {
  createPortalEventTicket,
  createPortalOrderItem,
  deletePortalEventTicket,
  deletePortalOrderItem,
  getPortalEventTickets,
  getPortalOrderItems,
  updatePortalEventTicket,
  updatePortalOrderItem,
} from '@/lib/services/portal.service'

import {
  labels,
  normalizeRelationData,
} from '@/components/features/portal/modal/portal-relations-modal/lib/portal-relations-modal-helpers'

export function PortalRelationsModal({
  isOpen,
  onOpenChange,
  kind,
  ownerId,
  ownerPaid,
}: PortalRelationsModalProps) {
  const [entity, setEntity] = useState<PortalRecord | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const { confirm } = useConfirmation()
  const { hasPermission } = useUserPermission()
  const config = kind ? portalResourceConfig(kind) : undefined

  const query = useQuery({
    queryKey: ['portal', kind, ownerId, 'nested'],
    queryFn: () =>
      kind === 'event-tickets'
        ? getPortalEventTickets(ownerId ?? 0)
        : getPortalOrderItems(ownerId ?? 0),
    enabled:
      isOpen &&
      ownerId !== null &&
      kind !== null &&
      Boolean(config && hasPermission(`${config.permission}.read`)),
  })

  const createMutation = useAppMutation({
    mutationFn: (data: Record<string, PortalValue>) =>
      kind === 'event-tickets'
        ? createPortalEventTicket(ownerId ?? 0, data)
        : createPortalOrderItem(ownerId ?? 0, data),
    invalidateKeys: [['portal', kind ?? '', ownerId ?? 0, 'nested']],
    successMessage: 'Related record created successfully',
    onSuccess: () => setFormOpen(false),
  })

  const updateMutation = useAppMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number
      data: Record<string, PortalValue>
    }) =>
      kind === 'event-tickets'
        ? updatePortalEventTicket(id, data)
        : updatePortalOrderItem(id, data),
    invalidateKeys: [['portal', kind ?? '', ownerId ?? 0, 'nested']],
    successMessage: 'Related record updated successfully',
    onSuccess: () => setFormOpen(false),
  })

  const deleteMutation = useAppMutation({
    mutationFn: (id: number) =>
      kind === 'event-tickets'
        ? deletePortalEventTicket(id)
        : deletePortalOrderItem(id),
    invalidateKeys: [['portal', kind ?? '', ownerId ?? 0, 'nested']],
    successMessage: 'Related record deleted successfully',
  })

  if (!kind || !config) return null

  const canCreate =
    kind === 'event-tickets' && hasPermission(`${config.permission}.create`)
  const canUpdate =
    (kind === 'event-tickets' || !ownerPaid) &&
    hasPermission(`${config.permission}.update`)
  const canDelete =
    kind === 'event-tickets' && hasPermission(`${config.permission}.delete`)
  const ownerField = kind === 'event-tickets' ? 'eventId' : 'orderId'
  const relationFields = config.fields.filter(
    (field) => field.key !== ownerField,
  )

  const openCreate = () => {
    setEntity(null)
    setFormOpen(true)
  }

  const openEdit = (record: PortalRecord) => {
    setEntity(record)
    setFormOpen(true)
  }

  const remove = async (id: number) => {
    if (
      await confirm({
        title: 'Delete related record?',
        message: 'This record will be soft-deleted.',
        color: 'danger',
      })
    ) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <>
      <Modal
        placement="center"
        classNames={portalModalClassNames}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-2">
                <ListTree size={20} className="text-primary" />
                {labels[kind].title}
              </ModalHeader>
              <ModalBody>
                {canCreate && (
                  <Button
                    color="primary"
                    startContent={<Plus size={16} />}
                    onPress={openCreate}
                  >
                    Add record
                  </Button>
                )}
                {query.isLoading ? (
                  <Spinner className="mx-auto my-8" />
                ) : (
                  <div className="flex flex-col gap-3">
                    {(query.data ?? []).map((record) => (
                      <Card
                        key={record.id}
                        className="border border-default-100"
                      >
                        <CardBody className="flex flex-row items-center justify-between gap-3 p-4">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-default-800">
                              {String(
                                record.name ?? record.title ?? `#${record.id}`,
                              )}
                            </div>
                            <div className="text-xs text-default-500">
                              #{record.id} ·{' '}
                              {String(
                                record.statusLabel ?? record.productType ?? '',
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            {canUpdate && (
                              <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                aria-label="Edit"
                                onPress={() => openEdit(record)}
                              >
                                <Pencil size={15} />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                isIconOnly
                                size="sm"
                                color="danger"
                                variant="flat"
                                aria-label="Delete"
                                onPress={() => remove(record.id)}
                              >
                                <Trash2 size={15} />
                              </Button>
                            )}
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                    {!query.isLoading && !query.data?.length && (
                      <p className="py-6 text-center text-sm text-default-500">
                        No related records.
                      </p>
                    )}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <PortalFormModal
        isOpen={formOpen}
        onOpenChange={setFormOpen}
        config={config}
        fields={relationFields}
        entity={entity}
        isReadOnly={false}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onSubmit={(data) => {
          const normalized = normalizeRelationData(data, relationFields)
          if (entity) updateMutation.mutate({ id: entity.id, data: normalized })
          else createMutation.mutate(normalized)
        }}
      />
    </>
  )
}
