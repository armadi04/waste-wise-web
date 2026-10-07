import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { useConfirmationStore } from '@/lib/stores/confirmation.store'

/**
 * Renders the global confirmation dialog. Mount once near the app root; it
 * subscribes to {@link useConfirmationStore} and is driven entirely by the
 * promise-based `confirm()` action.
 */
export function ConfirmationRoot() {
  const isOpen = useConfirmationStore((s) => s.isOpen)
  const options = useConfirmationStore((s) => s.options)
  const handleConfirm = useConfirmationStore((s) => s.handleConfirm)
  const handleCancel = useConfirmationStore((s) => s.handleCancel)

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      backdrop="blur"
      placement="center"
      hideCloseButton
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          {options.title || 'Konfirmasi'}
        </ModalHeader>
        <ModalBody>
          {typeof options.message === 'string' ? (
            <p>{options.message}</p>
          ) : (
            options.message
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="danger"
            variant="flat"
            fullWidth
            onPress={handleCancel}
          >
            {options.cancelText || 'Cancel'}
          </Button>
          <Button
            color={options.color || 'primary'}
            fullWidth
            onPress={handleConfirm}
          >
            {options.confirmText || 'Confirm'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
