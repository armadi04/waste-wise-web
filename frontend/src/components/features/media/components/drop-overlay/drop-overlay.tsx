import { UploadCloud } from 'lucide-react'

interface DropOverlayProps {
  isVisible: boolean
}

/**
 * Full-page drop target feedback. Rendered above the grid but
 * `pointer-events-none` so it never intercepts the drop itself.
 */
export function DropOverlay({ isVisible }: DropOverlayProps) {
  if (!isVisible) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-large border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-2 rounded-large bg-content1 px-6 py-5 shadow-large">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud size={22} />
        </span>
        <p className="text-sm font-semibold text-default-700">Drop to upload</p>
        <p className="text-xs text-default-400">
          Files are added to your media library
        </p>
      </div>
    </div>
  )
}
