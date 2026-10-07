import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Snippet,
} from '@heroui/react'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import type { TwoFactorModalProps } from '@/components/features/profile/modal/two-factor-modal/types'

import { COPY } from '@/components/features/profile/modal/two-factor-modal/lib/two-factor-modal-helpers'

/**
 * One dialog for the whole two-factor lifecycle. Every step that changes state
 * asks for a current code, because an unlocked browser alone must not be enough
 * to add, remove, or re-issue the second factor.
 */
export function TwoFactorModal({
  step,
  onClose,
  code,
  setCode,
  enrollment,
  recoveryCodes,
  onConfirm,
  onDisable,
  onRegenerate,
  isConfirming,
  isDisabling,
  isRegenerating,
}: TwoFactorModalProps) {
  if (!step) return null

  const copy = COPY[step]
  const isPending = isConfirming || isDisabling || isRegenerating
  const needsCode = step !== 'codes'

  const submit = () => {
    if (step === 'setup') return onConfirm()
    if (step === 'disable') return onDisable()
    if (step === 'regenerate') return onRegenerate()
    return onClose()
  }

  return (
    <Modal isOpen onOpenChange={(open) => !open && onClose()} size="lg">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          {copy.danger ? (
            <ShieldOff size={18} className="text-danger" />
          ) : (
            <ShieldCheck size={18} className="text-primary" />
          )}
          {copy.title}
        </ModalHeader>

        <ModalBody className="gap-4">
          {step === 'setup' && enrollment && (
            <>
              <p className="text-sm text-default-500">
                Scan this with your authenticator app, then enter the 6-digit
                code it shows.
              </p>
              <div className="flex justify-center">
                <img
                  src={enrollment.qrDataUrl}
                  alt="Two-factor QR code"
                  className="h-48 w-48 rounded-medium bg-white p-2"
                />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-default-400">
                  Can&apos;t scan? Enter this key manually:
                </p>
                <Snippet size="sm" variant="flat" symbol="" className="w-full">
                  {enrollment.secret}
                </Snippet>
              </div>
            </>
          )}

          {step === 'codes' && (
            <>
              <p className="text-sm text-default-500">
                Each code works once, and they are the only way back in if you
                lose your authenticator. Store them somewhere safe — they will
                not be shown again.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {recoveryCodes.map((recoveryCode) => (
                  <Snippet
                    key={recoveryCode}
                    size="sm"
                    variant="flat"
                    symbol=""
                    className="font-mono"
                  >
                    {recoveryCode}
                  </Snippet>
                ))}
              </div>
            </>
          )}

          {step === 'disable' && (
            <p className="text-sm text-default-500">
              Your account will be protected by its password alone. Enter a
              current code (or a recovery code) to confirm.
            </p>
          )}

          {step === 'regenerate' && (
            <p className="text-sm text-default-500">
              The codes you have now stop working. Enter a current code (or a
              recovery code) to confirm.
            </p>
          )}

          {needsCode && (
            <Input
              value={code}
              onValueChange={setCode}
              label="Authentication code"
              placeholder="123456"
              autoComplete="one-time-code"
              variant="bordered"
              labelPlacement="outside"
              isRequired
            />
          )}
        </ModalBody>

        <ModalFooter>
          {step !== 'codes' && (
            <Button variant="light" onPress={onClose} isDisabled={isPending}>
              Cancel
            </Button>
          )}
          <Button
            color={copy.danger ? 'danger' : 'primary'}
            onPress={submit}
            isLoading={isPending}
            isDisabled={isPending || (needsCode && code.trim().length < 6)}
          >
            {copy.confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
