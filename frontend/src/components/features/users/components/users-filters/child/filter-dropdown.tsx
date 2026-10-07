import { DropdownMenu, DropdownTrigger } from '@heroui/react'
import { ChevronDown } from 'lucide-react'
import { Button, Dropdown, DropdownItem } from '@/components/shared/controls'

export function FilterDropdown({
  value,
  options,
  label,
  icon,
  onChange,
}: {
  value?: string
  options: Array<{ key: string; label: string }>
  label: string
  icon: React.ReactNode
  onChange: (value?: string) => void
}) {
  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          size="sm"
          variant="flat"
          startContent={icon}
          endContent={<ChevronDown size={12} />}
        >
          {options.find((option) => option.key === (value ?? 'all'))?.label}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label={label}
        selectionMode="single"
        selectedKeys={new Set([value ?? 'all'])}
        onAction={(key) => onChange(key === 'all' ? undefined : String(key))}
      >
        {options.map((option) => (
          <DropdownItem key={option.key}>{option.label}</DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  )
}
