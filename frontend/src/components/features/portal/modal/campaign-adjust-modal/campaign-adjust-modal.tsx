import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from '@heroui/react'
import { useEffect, useState } from 'react'
import type { CampaignAdjustmentInput } from '@/lib/services/portal.service'
import type { PortalRecord } from '@/types/portal'

export function CampaignAdjustModal({
  isOpen,
  record,
  busy,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  record: PortalRecord | null
  busy: boolean
  onClose: () => void
  onSubmit: (data: CampaignAdjustmentInput) => void
}) {
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  // One key per opened modal: a retried submit after a network error reuses it,
  // so the ledger applies the adjustment at most once.
  const [idempotencyKey, setIdempotencyKey] = useState('')
  useEffect(() => {
    if (!isOpen) return
    setPoints('')
    setReason('')
    setIdempotencyKey(crypto.randomUUID())
  }, [isOpen, record?.id])
  const delta = Number(points)
  const valid =
    Number.isInteger(delta) && delta !== 0 && reason.trim().length >= 5
  const current = Number(record?.points ?? 0)
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideCloseButton={busy}
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
    >
      <ModalContent>
        <ModalHeader>Adjust campaign points</ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-500">
            User #{String(record?.userId ?? '')} · campaign #
            {String(record?.campaignId ?? '')} · current {current} points.
            Adjustments are written to the campaign ledger and audit trail.
          </p>
          <Input
            label="Points (negative to deduct)"
            type="number"
            step="1"
            isRequired
            value={points}
            onValueChange={setPoints}
            isDisabled={busy}
            description={
              Number.isInteger(delta) && delta !== 0
                ? `New balance: ${Math.max(0, current + delta)} points`
                : undefined
            }
          />
          <Textarea
            label="Reason"
            isRequired
            minLength={5}
            maxLength={500}
            value={reason}
            onValueChange={setReason}
            isDisabled={busy}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" isDisabled={busy} onPress={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            isLoading={busy}
            isDisabled={!valid || busy || !record}
            onPress={() => {
              if (record)
                onSubmit({
                  userId: Number(record.userId),
                  campaignId: Number(record.campaignId),
                  points: delta,
                  reason: reason.trim(),
                  idempotencyKey,
                })
            }}
          >
            Apply adjustment
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
