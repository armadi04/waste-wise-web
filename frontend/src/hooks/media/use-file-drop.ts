import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'

interface UseFileDropOptions {
  onFiles: (files: Array<File>) => void
  disabled?: boolean
}

interface UseFileDropResult {
  isDragging: boolean
  dropProps: Pick<
    React.DOMAttributes<HTMLDivElement>,
    'onDragEnter' | 'onDragOver' | 'onDragLeave' | 'onDrop'
  >
}

/** Noise the OS and editors drop alongside real files. */
const IGNORED_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini'])

/** True only for a drag carrying actual files — not selected text or a link. */
const hasFiles = (dataTransfer: DataTransfer | null): boolean =>
  Boolean(dataTransfer) && Array.from(dataTransfer!.types).includes('Files')

/** Files chosen via drop or `<input type="file" multiple>`, noise removed. */
export const filesFromList = (list: FileList | null): Array<File> =>
  Array.from(list ?? []).filter((file) => !IGNORED_NAMES.has(file.name))

/**
 * Page-level drag-and-drop for files.
 *
 * Drag state is a *depth counter*, not a boolean: `dragleave` fires every time
 * the pointer crosses into a child element, so a boolean flag strobes as the
 * user moves across the grid.
 *
 * Flat files only — the media library has no folder hierarchy to mirror, so a
 * dropped directory contributes nothing.
 */
export function useFileDrop({
  onFiles,
  disabled = false,
}: UseFileDropOptions): UseFileDropResult {
  const [isDragging, setIsDragging] = useState(false)
  const depth = useRef(0)

  const reset = useCallback(() => {
    depth.current = 0
    setIsDragging(false)
  }, [])

  const onDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (disabled || !hasFiles(event.dataTransfer)) return
      event.preventDefault()
      event.stopPropagation()
      depth.current += 1
      if (depth.current === 1) setIsDragging(true)
    },
    [disabled],
  )

  const onDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (disabled || !hasFiles(event.dataTransfer)) return
      // Required on EVERY dragover or the browser never fires `drop`.
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    },
    [disabled],
  )

  const onDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (disabled || !hasFiles(event.dataTransfer)) return
      event.preventDefault()
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setIsDragging(false)
    },
    [disabled],
  )

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      reset()
      if (disabled || !hasFiles(event.dataTransfer)) return
      const files = filesFromList(event.dataTransfer.files)
      if (files.length > 0) onFiles(files)
    },
    [disabled, onFiles, reset],
  )

  useEffect(() => {
    // Without this, a file dropped anywhere outside the zone makes the browser
    // navigate away to the file:// URL.
    const swallow = (event: DragEvent) => {
      if (hasFiles(event.dataTransfer)) event.preventDefault()
    }
    // `dragleave` is not reliably delivered when the pointer exits the window.
    const onWindowDrop = (event: DragEvent) => {
      swallow(event)
      reset()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      // The browser owns the native drag; we can only clear our own overlay.
      if (event.key === 'Escape') reset()
    }

    window.addEventListener('dragover', swallow)
    window.addEventListener('drop', onWindowDrop)
    window.addEventListener('dragend', reset)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('dragover', swallow)
      window.removeEventListener('drop', onWindowDrop)
      window.removeEventListener('dragend', reset)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [reset])

  return {
    isDragging,
    dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
  }
}
