import { useState } from 'react'

interface MediaThumbnailProps {
  url: string
  alt: string
  /** Rendered instead of the image when it cannot be decoded. */
  fallback: React.ReactNode
  className?: string
}

/**
 * Progressive image tile for the media grid.
 *
 * Two behaviours it exists for. Images used to pop in at full sharpness one by
 * one; here the tile starts blurred and scaled slightly past its box, then
 * resolves on load, so the grid fills in smoothly instead of flashing. And a
 * file whose bytes are missing or not really an image — a 0-byte row, a dead
 * storage URL — must not leave the browser's broken-image glyph and alt text in
 * the card; it swaps to the file-type icon instead.
 */
export function MediaThumbnail({
  url,
  alt,
  fallback,
  className = '',
}: MediaThumbnailProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasFailed, setHasFailed] = useState(false)

  if (hasFailed) return <>{fallback}</>

  return (
    <span className="relative block h-full w-full overflow-hidden bg-default-100">
      <img
        src={url}
        // Empty alt on purpose: the filename is already printed beneath the
        // tile, and a non-empty alt is what renders as broken text mid-load.
        alt=""
        aria-label={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasFailed(true)}
        className={`h-full w-full object-cover transition-[filter,opacity,transform] duration-500 ease-out ${
          isLoaded
            ? 'scale-100 opacity-100 blur-0'
            : 'scale-105 opacity-0 blur-md'
        } ${className}`}
      />
      {/* Neutral fill behind the image so the card never shows a hole while the
          tile is still decoding. */}
      {!isLoaded && (
        <span className="absolute inset-0 animate-pulse bg-default-200/60" />
      )}
    </span>
  )
}
