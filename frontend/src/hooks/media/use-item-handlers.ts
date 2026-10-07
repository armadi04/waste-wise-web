import type { MediaActions } from '@/components/features/media/components/media-item'
import type { SelectModifiers } from '@/lib/stores/media-selection.store'
import type { Media } from '@/types/media'

import { modifiersOf } from '@/components/features/media/components/media-item/lib/media-item-helpers'

export function useItemHandlers(
  media: Media,
  actions: MediaActions,
  onSelect: (media: Media, modifiers: SelectModifiers) => void,
) {
  const onClick = (event: React.MouseEvent) => {
    // The click that ends a marquee drag must not collapse the sweep to one item.
    if (actions.wasDragging()) return
    onSelect(media, modifiersOf(event))
  }

  const onDoubleClick = (event: React.MouseEvent) => {
    if (actions.wasDragging()) return
    // A dblclick is preceded by two clicks, so the item is already selected —
    // opening on top of that matches Drive.
    event.preventDefault()
    actions.onOpen(media)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      actions.onOpen(media)
    } else if (event.key === ' ') {
      event.preventDefault()
      onSelect(media, { meta: true })
    }
  }

  return { onClick, onDoubleClick, onKeyDown }
}
