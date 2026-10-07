import {
  Button,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ScrollShadow,
} from '@heroui/react'
import { Search } from 'lucide-react'
import { useMemo } from 'react'
import type { RolePermissionsModalProps } from '@/components/features/roles/modal/role-permissions-modal/types'
import { useRolesUiStore } from '@/lib/stores/roles-ui.store'

export function RolePermissionsModal({
  isOpen,
  onOpenChange,
  role,
  allPermissions,
  isLoading = false,
  onSave,
}: RolePermissionsModalProps) {
  // Search/selection are UI state in the feature store; the selection is seeded
  // from the role's current permissions when the page hook opens this modal.
  const search = useRolesUiStore((s) => s.modals.permissions.search)
  const selectedPermissions = useRolesUiStore(
    (s) => s.modals.permissions.selected,
  )
  const setSearch = useRolesUiStore((s) => s.setSearch)
  const setSelected = useRolesUiStore((s) => s.setSelected)
  const toggleSelected = useRolesUiStore((s) => s.toggleSelected)

  const filteredPermissions = useMemo(() => {
    return allPermissions.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description?.toLowerCase().includes(search.toLowerCase()),
    )
  }, [allPermissions, search])

  const handleTogglePermission = (id: number) =>
    toggleSelected('permissions', id)

  const handleSelectAll = () => {
    if (selectedPermissions.size === filteredPermissions.length) {
      setSelected('permissions', new Set())
    } else {
      setSelected('permissions', new Set(filteredPermissions.map((p) => p.id)))
    }
  }

  const handleSave = () => {
    if (role) {
      onSave(role.id, Array.from(selectedPermissions))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      backdrop="blur"
      size="2xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Manage Permissions for {role?.name}
            </ModalHeader>
            <ModalBody>
              <Input
                placeholder="Search permissions..."
                startContent={<Search size={16} className="text-default-400" />}
                value={search}
                onValueChange={(v) => setSearch('permissions', v)}
                variant="flat"
              />

              <div className="flex justify-between items-center py-2">
                <span className="text-small text-default-500">
                  {selectedPermissions.size} selected
                </span>
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  onPress={handleSelectAll}
                >
                  {selectedPermissions.size === filteredPermissions.length
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              </div>

              <ScrollShadow className="h-[400px] w-full p-2 border-small rounded-medium border-default-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredPermissions.map((permission) => (
                    <div
                      key={permission.id}
                      className={`
                        flex items-start gap-2 p-3 rounded-large border-2 cursor-pointer transition-colors
                        ${
                          selectedPermissions.has(permission.id)
                            ? 'border-primary border-1 bg-primary-50'
                            : 'border-transparent bg-default-100 hover:bg-default-200'
                        }
                      `}
                      onClick={() => handleTogglePermission(permission.id)}
                    >
                      <Checkbox
                        isSelected={selectedPermissions.has(permission.id)}
                        onValueChange={() =>
                          handleTogglePermission(permission.id)
                        }
                        classNames={{
                          wrapper: 'mt-1',
                        }}
                      />
                      <div className="flex flex-col gap-1">
                        <span className="text-small font-semibold leading-none">
                          {permission.name}
                        </span>
                        {permission.description && (
                          <span className="text-tiny text-default-500">
                            {permission.description}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollShadow>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" color="danger" onPress={onClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleSave}
                isLoading={isLoading}
              >
                Save
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}
