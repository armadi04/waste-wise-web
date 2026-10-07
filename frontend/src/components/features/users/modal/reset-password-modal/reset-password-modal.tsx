import {
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { ResetPasswordFormData } from '@/lib/schemas/users'
import type { ResetPasswordModalProps } from '@/components/features/users/modal/reset-password-modal/types'
import { Button, Input, Modal } from '@/components/shared/controls'
import { resetPasswordSchema } from '@/lib/schemas/users'

export function ResetPasswordModal({
  isOpen,
  onOpenChange,
  user,
  onSubmit,
  isLoading = false,
}: ResetPasswordModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  useEffect(() => {
    if (isOpen) {
      reset({ password: '' })
    }
  }, [isOpen, reset])

  const handleFormSubmit = (data: ResetPasswordFormData) => {
    if (user) {
      onSubmit(user.id, data.password)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="sm"
      radius="lg"
      classNames={{
        base: 'border border-default-200 shadow-xl',
        header: 'border-b border-default-100',
        footer: 'border-t border-default-100',
      }}
    >
      <ModalContent>
        {(onClose) => (
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <ModalHeader className="flex gap-2 items-center text-default-800">
              <KeyRound size={20} className="text-[var(--app-link)]" />
              <span>Reset Password</span>
            </ModalHeader>
            <ModalBody className="py-6">
              <p className="text-sm text-default-500 mb-2">
                Set a new password for{' '}
                <span className="font-semibold text-default-700">
                  {user?.fullname}
                </span>
                .
              </p>
              <Input
                {...register('password')}
                label="New Password"
                placeholder="••••••••"
                type="password"
                variant="bordered"
                labelPlacement="outside"
                errorMessage={errors.password?.message}
                isInvalid={!!errors.password}
              />
            </ModalBody>
            <ModalFooter>
              <Button
                variant="flat"
                onPress={onClose}
                size="sm"
                className="font-semibold"
              >
                Cancel
              </Button>
              <Button
                color="primary"
                type="submit"
                isLoading={isLoading}
                size="sm"
                className="font-semibold"
              >
                Reset Password
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}
