import { DropdownMenu, DropdownTrigger } from '@heroui/react'
import {
  Copy,
  Download,
  ExternalLink,
  MoreVertical,
  Trash2,
} from 'lucide-react'
import type { MediaActions } from '@/components/features/media/components/media-item/types'
import type { Media } from '@/types/media'
import { Button, Dropdown, DropdownItem } from '@/components/shared/controls'
import { useTimeZone } from '@/lib/stores/time-zone'

export function MediaMenu({
  media,
  actions,
}: {
  media: Media
  actions: MediaActions
}) {
  useTimeZone((s) => s.timeZone)
  return (
    <Dropdown placement="bottom-end" classNames={{ content: 'shadow-xl' }}>
      <DropdownTrigger>
        <Button
          size="sm"
          variant="light"
          isIconOnly
          aria-label="Menu"
          className="h-6 w-6 min-w-6 data-[hover]:bg-default-100"
        >
          <MoreVertical size={15} className="text-default-400" />
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="File actions">
        <DropdownItem
          key="open"
          startContent={<ExternalLink size={15} />}
          onPress={() => actions.onOpen(media)}
        >
          Open
        </DropdownItem>
        <DropdownItem
          key="download"
          startContent={<Download size={15} />}
          onPress={() => actions.onDownload(media)}
        >
          Download
        </DropdownItem>
        <DropdownItem
          key="copy"
          startContent={<Copy size={15} />}
          onPress={() => actions.onCopyLink(media)}
        >
          Copy link
        </DropdownItem>
        {actions.hasPermission('media.delete') ? (
          <DropdownItem
            key="delete"
            className="text-[var(--app-danger)]"
            color="danger"
            startContent={<Trash2 size={15} />}
            onPress={() => actions.onDelete(media)}
          >
            Delete
          </DropdownItem>
        ) : null}
      </DropdownMenu>
    </Dropdown>
  )
}
