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
import type { WalletAdjustmentInput } from '@/lib/services/portal.service'

export function WalletAdjustModal({
  isOpen,
  userId,
  balance,
  busy,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  userId: number | null
  balance: number
  busy: boolean
  onClose: () => void
  onSubmit: (data: WalletAdjustmentInput) => void
}) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  // One key per opened modal, so retrying after a network error applies once.
  const [idempotencyKey, setIdempotencyKey] = useState('')
  useEffect(() => {
    if (!isOpen) return
    setAmount('')
    setReason('')
    setIdempotencyKey(crypto.randomUUID())
  }, [isOpen, userId])
  const delta = Number(amount)
  const next = balance + delta
  const valid =
    Number.isInteger(delta) &&
    delta !== 0 &&
    next >= 0 &&
    reason.trim().length >= 5
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideCloseButton={busy}
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
    >
      <ModalContent>
        <ModalHeader>Adjust wallet balance</ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-500">
            User #{userId} · current balance {balance.toLocaleString('id-ID')}{' '}
            coins. The change is recorded as an adjustment transaction and in
            the audit trail.
          </p>
          <Input
            label="Coins (negative to deduct)"
            type="number"
            step="1"
            isRequired
            value={amount}
            onValueChange={setAmount}
            isDisabled={busy}
            color={Number.isInteger(delta) && next < 0 ? 'danger' : 'default'}
            description={
              Number.isInteger(delta) && delta !== 0
                ? next < 0
                  ? 'Balance cannot go below zero'
                  : `New balance: ${next.toLocaleString('id-ID')} coins`
                : undefined
            }
          />
          <Textarea
            label="Reason"
            isRequired
            minLength={5}
            maxLength={150}
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
            isDisabled={!valid || busy || userId === null}
            onPress={() => {
              if (userId !== null)
                onSubmit({
                  userId,
                  amount: delta,
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
