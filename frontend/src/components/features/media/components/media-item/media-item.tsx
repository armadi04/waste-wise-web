import { Lock } from 'lucide-react'
import type { ItemProps } from '@/components/features/media/components/media-item/types'
import { MediaThumbnail } from '@/components/features/media/components/media-thumbnail'
import { useTimeZone } from '@/lib/stores/time-zone'
import { getFileType } from '@/lib/utils/file-type'
import { formatBytes } from '@/lib/utils/format'

import { useItemHandlers } from '@/hooks/media'

import { mediaTimestamp } from '@/components/features/media/components/media-item/lib/media-item-helpers'

import { MediaMenu } from '@/components/features/media/components/media-item/child'

export function MediaCard({ media, actions, isSelected, onSelect }: ItemProps) {
  useTimeZone((s) => s.timeZone)
  const info = getFileType(media.originalName, media.mimetype)
  const isImage = info.kind === 'image' && media.url
  const handlers = useItemHandlers(media, actions, onSelect)

  const icon = (
    <span
      className={`flex size-14 items-center justify-center rounded-large bg-content1 ${info.tint}`}
    >
      <info.icon size={28} />
    </span>
  )

  return (
    // The whole card is the hit target — click anywhere to select, double-click
    // anywhere to open.
    <div
      data-item-id={media.id}
      role="button"
      tabIndex={0}
      {...handlers}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-large border bg-content1 transition-all select-none hover:shadow-sm ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-default-100 hover:border-primary/40'
      }`}
    >
      {/* Square tile: a fixed-height box left portrait and landscape images
          cropped differently, so the grid read as ragged. */}
      <div className="flex aspect-square items-center justify-center overflow-hidden border-b border-default-100 bg-default-50/50">
        {isImage ? (
          <MediaThumbnail
            url={media.url!}
            alt={media.originalName}
            fallback={icon}
          />
        ) : (
          icon
        )}
      </div>

      <div className="flex items-center gap-1 px-2.5 py-2">
        <div className="flex min-w-0 flex-1 flex-col text-left">
          <div className="flex items-center gap-1">
            {media.isPrivate && (
              <Lock size={11} className="shrink-0 text-warning" />
            )}
            <span className="min-w-0 truncate text-xs font-medium text-default-700">
              {media.originalName}
            </span>
          </div>
          <span className="truncate text-[10px] text-default-400">
            {info.label} · {formatBytes(media.size)}
          </span>
          {/* Relative phrasing for a glance, exact moment on hover. */}
          <span
            title={mediaTimestamp(media).exact}
            className="truncate text-[10px] text-default-400"
          >
            {mediaTimestamp(media).relative}
          </span>
        </div>
        <div className="opacity-0 group-hover:opacity-100">
          <MediaMenu media={media} actions={actions} />
        </div>
      </div>
    </div>
  )
}
