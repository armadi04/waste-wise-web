import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/react'
import { MoreVertical } from 'lucide-react'
import type React from 'react'

export interface RowAction {
  key: string
  label: string
  icon: React.ReactNode
  onPress: () => void
  /** Render the entry in danger color (e.g. delete/revoke) */
  danger?: boolean
  /** When false, the entry is omitted (permission / status gating) */
  show?: boolean
}

/**
 * A three-dots (kebab) button that opens a dropdown of row actions.
 * Entries with `show === false` are filtered out; when none remain the
 * button is not rendered at all.
 */
export function ActionMenu({ actions }: { actions: Array<RowAction> }) {
  const visible = actions.filter((action) => action.show !== false)

  if (visible.length === 0) return null

  return (
    <Dropdown placement="bottom-end" classNames={{ content: 'shadow-xl' }}>
      <DropdownTrigger>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          aria-label="Actions"
          className="text-default-400 data-[hover]:bg-default-100"
        >
          <MoreVertical size={16} />
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Row actions">
        {visible.map((action) => (
          <DropdownItem
            key={action.key}
            startContent={action.icon}
            color={action.danger ? 'danger' : 'default'}
            className={action.danger ? 'text-danger' : undefined}
            onPress={action.onPress}
          >
            {action.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  )
}
