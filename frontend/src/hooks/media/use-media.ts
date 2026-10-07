import { addToast } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Media } from '@/types/media'
import type { SelectModifiers } from '@/lib/stores/media-selection.store'
import type { MediaSortKey } from '@/lib/schemas/media'
import { useAppMutation } from '@/hooks/global/use-mutations'
import { useExportExcel } from '@/hooks/global/use-export-excel'
import { useDataTable } from '@/hooks/global/use-data-table'
import { useConfirmation } from '@/hooks/global/use-confirmation'

import { mediaExportColumns } from '@/components/features/media/components/table-columns'
import { useUserPermission } from '@/hooks/permissions/use-permissions'
import { mediaQueryOptions } from '@/lib/query/options'
import {
  bulkDeleteMedia,
  deleteMedia,
  getMediaList,
  uploadMedia,
} from '@/lib/services/media.service'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useMediaSelectionStore } from '@/lib/stores/media-selection.store'
import { useMediaUiStore } from '@/lib/stores/media-ui.store'
import { downloadFile } from '@/lib/utils/download'

const routeApi = getRouteApi('/(media)/media')

// --- Data Hooks ---

export const useMedia = () => {
  const { page, limit, search, sort, direction } = routeApi.useSearch()

  return useQuery({
    ...mediaQueryOptions({ page, limit, search, sort, direction }),
    enabled: useAuthStore(
      (state) => state.user?.permissions.includes('media.read') ?? false,
    ),
  })
}

/**
 * Upload files one at a time.
 *
 * Sequential on purpose: the backend throttles `media/upload` to 30 requests a
 * minute, and a parallel burst of a folder's worth of files would trip it and
 * fail most of the batch.
 */
export const useUploadMedia = () => {
  const [progress, setProgress] = useState<{
    done: number
    total: number
  } | null>(null)

  const mutation = useAppMutation({
    mutationFn: async (files: Array<File>) => {
      const failed: Array<string> = []
      setProgress({ done: 0, total: files.length })
      for (const [index, file] of files.entries()) {
        try {
          await uploadMedia(file)
        } catch {
          failed.push(file.name)
        }
        setProgress({ done: index + 1, total: files.length })
      }
      return { uploaded: files.length - failed.length, failed }
    },
    invalidateKeys: ['media'],
    onSettled: () => setProgress(null),
    onSuccess: ({ uploaded, failed }) => {
      if (uploaded > 0) {
        addToast({
          title: 'Upload complete',
          description: `${uploaded} file(s) uploaded`,
          color: 'primary',
        })
      }
      if (failed.length > 0) {
        addToast({
          title: 'Some uploads failed',
          description: failed.join(', '),
          color: 'danger',
        })
      }
    },
  })

  return { ...mutation, progress }
}

// --- Page Hook ---

export const useMediaPage = () => {
  const tableState = useDataTable(routeApi)
  const navigate = routeApi.useNavigate()
  const { view = 'grid' } = routeApi.useSearch()
  const { data, isLoading } = useMedia()
  const { hasPermission } = useUserPermission()
  const { confirm } = useConfirmation()
  const [isDownloading, setIsDownloading] = useState(false)

  const items = useMemo(() => data?.data ?? [], [data])
  const orderedIds = useMemo(() => items.map((item) => item.id), [items])
  // Read through a ref inside callbacks so selecting does not need to re-create
  // handlers on every data change.
  const orderedIdsRef = useRef(orderedIds)
  orderedIdsRef.current = orderedIds

  const ui = useMediaUiStore(
    useShallow((s) => ({
      open: s.open,
      onOpenChange: s.onOpenChange,
      viewOpen: s.modals.view.isOpen,
      viewEntity: s.modals.view.entity,
    })),
  )

  const selection = useMediaSelectionStore(
    useShallow((s) => ({
      selectedIds: s.selectedIds,
      select: s.select,
      selectAll: s.selectAll,
      setSelection: s.setSelection,
      clear: s.clear,
    })),
  )

  const upload = useUploadMedia()

  const deleteMutation = useAppMutation({
    mutationFn: deleteMedia,
    invalidateKeys: ['media'],
    successMessage: 'Media deleted successfully',
  })

  const bulkDeleteMutation = useAppMutation({
    mutationFn: bulkDeleteMedia,
    invalidateKeys: ['media'],
    successMessage: 'Media deleted successfully',
  })

  const selectedList = useMemo(
    () => Array.from(selection.selectedIds),
    [selection.selectedIds],
  )
  const selectedItems = useMemo(
    () => items.filter((item) => selection.selectedIds.has(item.id)),
    [items, selection.selectedIds],
  )

  // A selection is only meaningful for what is on screen: paging, searching or
  // re-sorting swaps the whole set out from under it, and a stale id would then
  // be deleted by a bulk action the user can no longer see.
  const { page, limit, search, sortDescriptor } = tableState
  useEffect(() => {
    selection.clear()
  }, [
    page,
    limit,
    search,
    sortDescriptor.column,
    sortDescriptor.direction,
    selection.clear,
  ])

  const onSelectItem = useCallback(
    (media: Media, modifiers: SelectModifiers) =>
      selection.select(media.id, modifiers, orderedIdsRef.current),
    [selection.select],
  )

  const getSelection = useCallback(
    () => Array.from(useMediaSelectionStore.getState().selectedIds),
    [],
  )

  const selectAll = useCallback(
    () => selection.selectAll(orderedIdsRef.current),
    [selection.selectAll],
  )

  const setView = (next: 'grid' | 'list') =>
    navigate({ search: (prev: any) => ({ ...prev, view: next }) })

  const sortKey = (sortDescriptor.column as MediaSortKey) || 'createdAt'
  const sortDir = sortDescriptor.direction === 'ascending' ? 'asc' : 'desc'

  const setSort = (key: MediaSortKey) =>
    tableState.onSortChange({
      column: key,
      direction: sortDescriptor.direction,
    })

  const toggleSortDir = () =>
    tableState.onSortChange({
      column: sortKey,
      direction:
        sortDescriptor.direction === 'ascending' ? 'descending' : 'ascending',
    })

  const handleView = (media: Media) => ui.open('view', media)

  const handleUpload = (files: Array<File>) => {
    if (files.length === 0) return
    upload.mutate(files)
  }

  const handleDownload = async (media: Media) => {
    if (!media.url) return
    await downloadFile(media.url, media.originalName)
  }

  const handleCopyLink = async (media: Media) => {
    if (!media.url) return
    try {
      await navigator.clipboard.writeText(media.url)
      addToast({ title: 'Link copied', color: 'primary' })
    } catch {
      addToast({ title: 'Could not copy the link', color: 'danger' })
    }
  }

  /**
   * Bulk download is one browser download per file, in sequence — there is no
   * server-side archive endpoint, and firing them in parallel makes the browser
   * drop all but the first few.
   */
  const handleBulkDownload = async () => {
    setIsDownloading(true)
    try {
      for (const item of selectedItems) {
        if (item.url) await downloadFile(item.url, item.originalName)
      }
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDelete = async (media: Media) => {
    const isConfirmed = await confirm({
      title: 'Delete Media',
      message: `Delete “${media.originalName}”? This cannot be undone.`,
      color: 'danger',
    })
    if (isConfirmed) deleteMutation.mutate(media.id)
  }

  const handleBulkDelete = async () => {
    const isConfirmed = await confirm({
      title: 'Delete Media',
      message: `Delete ${selectedList.length} selected file(s)? This cannot be undone.`,
      color: 'danger',
    })
    if (isConfirmed) {
      bulkDeleteMutation.mutate(selectedList, { onSuccess: selection.clear })
    }
  }

  const { onExport, isExporting } = useExportExcel({
    filename: 'Media',
    sheetName: 'Media',
    columns: mediaExportColumns,
    fetchAll: async () => {
      const res = await getMediaList({ paginated: false })
      return Array.isArray(res) ? res : res.data
    },
  })

  return {
    items,
    orderedIds,
    meta: data?.meta,
    isLoading,
    view,
    setView,
    sortKey,
    sortDir,
    setSort,
    toggleSortDir,
    search: tableState.search,
    onSearch: tableState.onSearch,
    page: tableState.page,
    onPageChange: tableState.onPageChange,
    hasPermission,
    canUpload: hasPermission('media.create'),
    selectedIds: selection.selectedIds,
    selectedList,
    onSelectItem,
    onMarqueeSelect: selection.setSelection,
    getSelection,
    selectAll,
    clearSelection: selection.clear,
    onUpload: handleUpload,
    uploadProgress: upload.progress,
    isUploading: upload.isPending,
    onView: handleView,
    onDownload: handleDownload,
    onCopyLink: handleCopyLink,
    onDelete: handleDelete,
    onBulkDelete: handleBulkDelete,
    onBulkDownload: handleBulkDownload,
    isBulkDeleting: bulkDeleteMutation.isPending,
    isDownloading,
    onExport,
    isExporting,
    modalProps: {
      isOpen: ui.viewOpen,
      onOpenChange: ui.onOpenChange('view'),
      media: ui.viewEntity,
    },
  }
}
