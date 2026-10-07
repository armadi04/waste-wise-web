import type { Media } from '@/types/media'

export interface MediaDetailModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  media: Media | null
}
