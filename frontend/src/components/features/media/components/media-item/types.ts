import type { SelectModifiers } from '@/lib/stores/media-selection.store'
import type { Media } from '@/types/media'

export interface MediaActions {
  onOpen: (media: Media) => void
  onDownload: (media: Media) => void
  onCopyLink: (media: Media) => void
  onDelete: (media: Media) => void
  /** True for the click that ends a marquee drag — that click must do nothing. */
  wasDragging: () => boolean
  hasPermission: (permission: string) => boolean
}

export interface ItemProps {
  media: Media
  actions: MediaActions
  isSelected: boolean
  onSelect: (media: Media, modifiers: SelectModifiers) => void
}
