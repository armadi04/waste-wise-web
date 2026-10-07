import {
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ScrollShadow,
} from '@heroui/react'
import { Search } from 'lucide-react'
import { useMemo } from 'react'
import type { UserRolesModalProps } from '@/components/features/users/modal/user-roles-modal/types'
import { Button, Checkbox, Input, Modal } from '@/components/shared/controls'
import { useUsersUiStore } from '@/lib/stores/users-ui.store'

export function UserRolesModal({
  isOpen,
  onOpenChange,
  user,
  allRoles,
  isLoading = false,
  onSave,
}: UserRolesModalProps) {
  // Search/selection are UI state in the feature store; the selection is seeded
  // from the user's current roles when the page hook opens this modal.
  const search = useUsersUiStore((s) => s.modals.roles.search)
  const selectedRoles = useUsersUiStore((s) => s.modals.roles.selected)
  const setSearch = useUsersUiStore((s) => s.setSearch)
  const setSelected = useUsersUiStore((s) => s.setSelected)
  const toggleSelected = useUsersUiStore((s) => s.toggleSelected)

  const filteredRoles = useMemo(() => {
    return allRoles.filter(
      (r) =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.description?.toLowerCase().includes(search.toLowerCase()),
    )
  }, [allRoles, search])

  const handleToggleRole = (id: number) => toggleSelected('roles', id)

  const handleSelectAll = () => {
    if (selectedRoles.size === filteredRoles.length) {
      setSelected('roles', new Set())
    } else {
      setSelected('roles', new Set(filteredRoles.map((r) => r.id)))
    }
  }

  const handleSave = () => {
    if (user) {
      onSave(user.id, Array.from(selectedRoles))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Manage Roles for {user?.fullname}
            </ModalHeader>
            <ModalBody>
              <Input
                aria-label="Search roles..."
                placeholder="Search roles..."
                startContent={<Search size={16} className="text-default-400" />}
                value={search}
                onValueChange={(v) => setSearch('roles', v)}
                variant="flat"
              />

              <div className="flex justify-between items-center py-2">
                <span className="text-small text-default-500">
                  {selectedRoles.size} selected
                </span>
                <Button
                  size="sm"
                  variant="flat"
                  color="primary"
                  onPress={handleSelectAll}
                >
                  {selectedRoles.size === filteredRoles.length
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              </div>

              <ScrollShadow className="h-[400px] w-full p-2 border-small rounded-medium border-default-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredRoles.map((role) => (
                    <div
                      key={role.id}
                      className={`
                        flex items-start gap-2 p-3 rounded-large border-2 cursor-pointer transition-colors
                        ${
                          selectedRoles.has(role.id)
                            ? 'app-selected border border-[var(--app-selected-border)]'
                            : 'border-transparent bg-default-100 hover:bg-default-200'
                        }
                      `}
                      onClick={() => handleToggleRole(role.id)}
                    >
                      <Checkbox
                        aria-label={role.name}
                        isSelected={selectedRoles.has(role.id)}
                        onValueChange={() => handleToggleRole(role.id)}
                        classNames={{
                          wrapper: 'mt-1',
                        }}
                        color="secondary"
                      />
                      <div className="flex flex-col gap-1">
                        <span className="text-small font-semibold leading-none">
                          {role.name}
                        </span>
                        {role.description && (
                          <span className="text-tiny text-default-500">
                            {role.description}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollShadow>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
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
