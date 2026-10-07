import { Lock } from 'lucide-react'
import type { ItemProps } from '@/components/features/media/components/media-item/types'
import { MediaThumbnail } from '@/components/features/media/components/media-thumbnail'
import { useTimeZone } from '@/lib/stores/time-zone'
import { getFileType } from '@/lib/utils/file-type'
import { formatBytes } from '@/lib/utils/format'

import { useItemHandlers } from '@/hooks/media'

import { mediaTimestamp } from '@/components/features/media/components/media-item/lib/media-item-helpers'

import { MediaMenu } from '@/components/features/media/components/media-item/child/media-menu'

export function MediaRow({ media, actions, isSelected, onSelect }: ItemProps) {
  useTimeZone((s) => s.timeZone)
  const name = media.originalName ?? media.filename
  const info = getFileType(name, media.mimetype)
  const isImage = info.kind === 'image' && media.url
  const handlers = useItemHandlers(media, actions, onSelect)

  const icon = (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-medium bg-default-100 ${info.tint}`}
    >
      <info.icon size={16} />
    </span>
  )

  return (
    <div
      data-item-id={media.id}
      role="button"
      tabIndex={0}
      {...handlers}
      className={`group flex cursor-pointer items-center gap-3 rounded-large border bg-content1 px-4 py-2.5 transition-all select-none ${
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-default-100 hover:border-primary/40'
      }`}
    >
      {isImage ? (
        <span className="size-9 shrink-0 overflow-hidden rounded-medium">
          <MediaThumbnail url={media.url!} alt={name} fallback={icon} />
        </span>
      ) : (
        icon
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1">
          {media.isPrivate && (
            <Lock size={11} className="shrink-0 text-warning" />
          )}
          <span className="truncate text-sm font-medium text-default-700">
            {name}
          </span>
        </div>
        <span
          title={mediaTimestamp(media).exact}
          className="truncate text-[11px] text-default-400"
        >
          {`${info.label} · ${formatBytes(media.size)} · ${mediaTimestamp(media).relative}`}
        </span>
      </div>
      <div className="opacity-0 group-hover:opacity-100">
        <MediaMenu media={media} actions={actions} />
      </div>
    </div>
  )
}
