import { useEffect, useRef } from 'react'
import type { MediaActions } from '@/components/features/media/components/media-item'
import { useDebouncedCallback } from '@/hooks/global/use-debounced-callback'
import { useFileDrop } from '@/hooks/media/use-file-drop'
import { useMarqueeSelection } from '@/hooks/media/use-marquee-selection'
import { useMediaPage } from '@/hooks/media/use-media'

export function useMediaPageState() {
  const {
    items,
    meta,
    isLoading,
    view,
    setView,
    sortKey,
    sortDir,
    setSort,
    toggleSortDir,
    search,
    onSearch,
    page,
    onPageChange,
    hasPermission,
    canUpload,
    selectedIds,
    selectedList,
    onSelectItem,
    onMarqueeSelect,
    getSelection,
    selectAll,
    clearSelection,
    onUpload,
    uploadProgress,
    isUploading,
    onView,
    onDownload,
    onCopyLink,
    onDelete,
    onBulkDelete,
    onBulkDownload,
    isBulkDeleting,
    isDownloading,
    onExport,
    isExporting,
    modalProps,
  } = useMediaPage()

  const fileRef = useRef<HTMLInputElement>(null)

  const debouncedSearch = useDebouncedCallback(onSearch, 400)

  const { isDragging, dropProps } = useFileDrop({
    onFiles: onUpload,
    disabled: !canUpload,
  })

  const marquee = useMarqueeSelection({
    onSelect: onMarqueeSelect,
    getSelection,
    // A file drag and a rubber-band drag would fight over the same gesture.
    disabled: isDragging,
  })

  // Drive's page-level keyboard: select everything, or drop the selection.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [role="dialog"]')) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        selectAll()
      } else if (event.key === 'Escape') {
        clearSelection()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectAll, clearSelection])

  const hasSelection = selectedList.length > 0

  const totalPages = meta?.lastPage ?? 1

  const actions: MediaActions = {
    onOpen: onView,
    onDownload: (media) => void onDownload(media),
    onCopyLink: (media) => void onCopyLink(media),
    onDelete: (media) => void onDelete(media),
    wasDragging: marquee.wasDragging,
    hasPermission,
  }
  return {
    items,
    isLoading,
    view,
    setView,
    sortKey,
    sortDir,
    setSort,
    toggleSortDir,
    search,
    page,
    onPageChange,
    hasPermission,
    canUpload,
    selectedIds,
    selectedList,
    onSelectItem,
    clearSelection,
    onUpload,
    uploadProgress,
    isUploading,
    onBulkDelete,
    onBulkDownload,
    isBulkDeleting,
    isDownloading,
    onExport,
    isExporting,
    modalProps,
    fileRef,
    debouncedSearch,
    isDragging,
    dropProps,
    marquee,
    hasSelection,
    totalPages,
    actions,
  }
}
