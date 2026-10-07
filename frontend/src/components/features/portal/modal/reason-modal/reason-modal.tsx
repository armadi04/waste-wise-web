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

/** Confirmation that requires an audited reason, e.g. revoking a customer's gift. */
export function ReasonModal({
  isOpen,
  title,
  description,
  confirmLabel,
  busy,
  minLength = 5,
  onClose,
  onSubmit,
}: {
  isOpen: boolean
  title: string
  description: string
  confirmLabel: string
  busy: boolean
  minLength?: number
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (isOpen) setReason('')
  }, [isOpen])
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      hideCloseButton={busy}
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
    >
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody>
          <p className="text-sm text-default-500">{description}</p>
          <Textarea
            label="Reason"
            isRequired
            minLength={minLength}
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
            isDisabled={reason.trim().length < minLength || busy}
            onPress={() => onSubmit(reason.trim())}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
