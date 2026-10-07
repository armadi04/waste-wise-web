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
  Textarea,
} from '@heroui/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Shield } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type { RoleFormData } from '@/lib/schemas/roles'
import type { RoleFormModalProps } from '@/components/features/roles/modal/role-form-modal/types'
import { roleSchema } from '@/lib/schemas/roles'

import { DetailRow } from '@/components/features/roles/modal/role-form-modal/child/detail-row'

export function RoleFormModal({
  isOpen,
  onOpenChange,
  editingRole,
  onSubmit,
  isLoading = false,
  isReadOnly = false,
}: RoleFormModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
  })

  useEffect(() => {
    if (isOpen) {
      if (editingRole) {
        reset({
          name: editingRole.name,
          description: editingRole.description || '',
        })
      } else {
        reset({ name: '', description: '' })
      }
    }
  }, [isOpen, editingRole, reset])

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
              <Shield size={20} className="text-primary" />
              <span>
                {isReadOnly
                  ? 'Role Details'
                  : editingRole
                    ? 'Edit Role'
                    : 'Create Role'}
              </span>
            </ModalHeader>

            <ModalBody className="pb-6">
              {isReadOnly ? (
                <div className="flex flex-col gap-4">
                  <DetailRow label="Role Name" value={editingRole?.name} />
                  <DetailRow
                    label="Description"
                    value={
                      editingRole?.description || 'No description provided'
                    }
                  />

                  {editingRole?.permissions?.length ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-default-400 uppercase tracking-widest whitespace-nowrap">
                          Assigned Permissions
                        </span>
                        <Divider className="flex-1" />
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
                        {editingRole.permissions.map((p) => (
                          <Chip
                            key={p.id}
                            size="sm"
                            variant="flat"
                            color="primary"
                            className="font-medium"
                          >
                            {p.name}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <form
                  id="role-form"
                  onSubmit={handleSubmit(onSubmit)}
                  className="flex flex-col gap-4"
                >
                  <Input
                    {...register('name')}
                    label="Role Name"
                    placeholder="e.g. content_manager"
                    variant="bordered"
                    labelPlacement="outside"
                    errorMessage={errors.name?.message}
                    isInvalid={!!errors.name}
                  />
                  <Textarea
                    {...register('description')}
                    label="Description"
                    placeholder="Describe the scope and purpose of this role..."
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
                  form="role-form"
                  isLoading={isLoading}
                  className="px-8 font-medium"
                >
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </Button>
              )}
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
