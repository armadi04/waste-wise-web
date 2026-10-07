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
import { zodResolver } from '@hookform/resolvers/zod'
import { Key } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { PermissionFormData } from '@/lib/schemas/permissions'
import type { PermissionFormModalProps } from '@/components/features/permissions/modal/permission-form-modal/types'
import { permissionSchema } from '@/lib/schemas/permissions'

import { DetailRow } from '@/components/features/permissions/modal/permission-form-modal/child/detail-row'

export function PermissionFormModal({
  isOpen,
  onOpenChange,
  editingPermission,
  onSubmit,
  isLoading = false,
  isReadOnly = false,
}: PermissionFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PermissionFormData>({
    resolver: zodResolver(permissionSchema),
  })

  useEffect(() => {
    if (isOpen) {
      if (editingPermission) {
        reset({
          name: editingPermission.name,
          description: editingPermission.description || '',
        })
      } else {
        reset({ name: '', description: '' })
      }
    }
  }, [isOpen, editingPermission, reset])

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex gap-2 items-center">
              <Key size={20} className="text-primary" />
              <span>
                {isReadOnly
                  ? 'Permission Details'
                  : editingPermission
                    ? 'Edit Permission'
                    : 'Create Permission'}
              </span>
            </ModalHeader>

            <ModalBody className="pb-6">
              {isReadOnly ? (
                <div className="flex flex-col gap-4">
                  <DetailRow
                    label="Permission Name"
                    value={editingPermission?.name}
                    mono
                  />
                  <DetailRow
                    label="Description"
                    value={
                      editingPermission?.description ||
                      'No description provided'
                    }
                  />
                  <div className="flex items-center justify-between py-3 px-4 rounded-large bg-default-50 border border-default-100">
                    <span className="text-[10px] font-bold text-default-400 uppercase tracking-widest">
                      Internal ID
                    </span>
                    <span className="text-sm font-mono font-bold text-primary">
                      #{editingPermission?.id}
                    </span>
                  </div>
                </div>
              ) : (
                <form
                  id="permission-form"
                  onSubmit={handleSubmit(onSubmit)}
                  className="flex flex-col gap-4"
                >
                  <Input
                    {...register('name')}
                    label="Permission Name"
                    placeholder="e.g. posts.create"
                    variant="bordered"
                    labelPlacement="outside"
                    description="Use dot notation to group related permissions"
                    errorMessage={errors.name?.message}
                    isInvalid={!!errors.name}
                  />
                  <Textarea
                    {...register('description')}
                    label="Description"
                    placeholder="Describe what this permission allows..."
                    variant="bordered"
                    labelPlacement="outside"
                    minRows={3}
                    errorMessage={errors.description?.message}
                    isInvalid={!!errors.description}
                  />
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
                  form="permission-form"
                  isLoading={isLoading}
                  className="px-8 font-medium"
                >
                  {editingPermission ? 'Save Changes' : 'Create Permission'}
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
