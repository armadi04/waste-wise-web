import type { SelectModifiers } from '@/lib/stores/media-selection.store'
import type { Media } from '@/types/media'
import { formatDateTime, formatRelativeTime } from '@/lib/utils/format'

export const mediaTimestamp = (media: Media) => {
  const changed = media.updatedAt && media.updatedAt !== media.createdAt
  const stamp = changed ? media.updatedAt : media.createdAt
  const verb = changed ? 'Changed' : 'Uploaded'
  return {
    relative: `${verb} ${formatRelativeTime(stamp)}`,
    exact: `${verb} ${formatDateTime(stamp)}`,
  }
}

export const modifiersOf = (event: {
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}): SelectModifiers => ({
  meta: event.metaKey || event.ctrlKey,
  shift: event.shiftKey,
})
