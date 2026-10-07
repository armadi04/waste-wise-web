import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from '@heroui/react'
import { useEffect, useState } from 'react'
import type { PortalRecord } from '@/types/portal'

export function RefundRejectModal({
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
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (isOpen) setReason('')
  }, [isOpen, record?.id])
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideCloseButton={busy}
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
    >
      <ModalContent>
        <ModalHeader>
          Reject refund · {String(record?.orderNumber ?? '')}
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-500">
            Benefits become usable again if they have not expired.
          </p>
          <Textarea
            label="Reason"
            isRequired
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
            color="danger"
            isLoading={busy}
            isDisabled={!reason.trim() || busy}
            onPress={() => onSubmit(reason.trim())}
          >
            Reject refund
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
