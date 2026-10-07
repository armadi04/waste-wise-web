import {
  Button,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Phone, User } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { UserFormData } from '@/lib/schemas/users'
import type { UserFormModalProps } from '@/components/features/users/modal/user-form-modal/types'
import { updateUserSchema } from '@/lib/schemas/users'

import { DetailRow } from '@/components/features/users/modal/user-form-modal/child/detail-row'

export function UserFormModal({
  isOpen,
  onOpenChange,
  editingUser,
  onSubmit,
  isLoading = false,
  isReadOnly = false,
}: UserFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(updateUserSchema),
  })

  useEffect(() => {
    if (isOpen && editingUser) {
      reset({
        email: editingUser.email,
        fullname: editingUser.fullname || '',
        phone: editingUser.phone,
      })
    }
  }, [isOpen, editingUser, reset])

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex gap-2 items-center">
              <User size={20} className="text-primary" />
              <span>{isReadOnly ? 'User Details' : 'Edit User'}</span>
            </ModalHeader>

            <ModalBody className="pb-6">
              {isReadOnly ? (
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-3">
                    <DetailRow
                      icon={User}
                      label="Full Name"
                      value={editingUser?.fullname || ''}
                    />
                    <DetailRow
                      icon={Mail}
                      label="Email"
                      value={editingUser?.email || ''}
                    />
                    <DetailRow
                      icon={Phone}
                      label="Phone"
                      value={editingUser?.phone || ''}
                    />
                  </div>

                  {editingUser?.roles?.length ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-default-400 uppercase tracking-widest whitespace-nowrap">
                          User Roles
                        </span>
                        <Divider className="flex-1" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {editingUser.roles.map((role) => (
                          <Chip
                            key={role.id}
                            size="sm"
                            variant="flat"
                            color="primary"
                            className="font-medium"
                          >
                            {role.name}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {editingUser?.permissions?.length ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-default-400 uppercase tracking-widest whitespace-nowrap">
                          Active Permissions
                        </span>
                        <Divider className="flex-1" />
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                        {editingUser.permissions.map((permission) => (
                          <Chip
                            key={permission.id}
                            size="sm"
                            variant="bordered"
                            className="text-tiny"
                          >
                            {permission.name}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <form
                  id="user-form"
                  onSubmit={handleSubmit(onSubmit)}
                  className="flex flex-col gap-4"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      {...register('fullname')}
                      label="Full Name"
                      placeholder="Enter full name"
                      variant="bordered"
                      labelPlacement="outside"
                      errorMessage={errors.fullname?.message}
                      isInvalid={!!errors.fullname}
                    />
                    <Input
                      {...register('email')}
                      label="Email"
                      placeholder="Enter email address"
                      variant="bordered"
                      labelPlacement="outside"
                      errorMessage={errors.email?.message}
                      isInvalid={!!errors.email}
                    />
                    <Input
                      {...register('phone')}
                      label="Phone"
                      placeholder="Enter phone number"
                      variant="bordered"
                      labelPlacement="outside"
                      errorMessage={errors.phone?.message}
                      isInvalid={!!errors.phone}
                      className="md:col-span-2"
                    />
                  </div>
                </form>
              )}
            </ModalBody>

            <ModalFooter>
              <Button variant="flat" onPress={onClose} className="font-medium">
                {isReadOnly ? 'Close' : 'Cancel'}
              </Button>
              {!isReadOnly && (
                <Button
                  color="primary"
                  type="submit"
                  form="user-form"
                  isLoading={isLoading}
                  className="px-8 font-medium"
                >
                  Save Changes
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
