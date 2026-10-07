import { Pagination } from '@heroui/react'
import { UploadCloud } from 'lucide-react'
import { DropOverlay } from '@/components/features/media/components/drop-overlay'
import { MediaCard } from '@/components/features/media/components/media-item'
import { MediaRow } from '@/components/features/media/components/media-item/child'
import { MediaDetailModal } from '@/components/features/media/modal/media-detail-modal'
import { MediaToolbar } from '@/components/features/media/pages/media/child/media-toolbar'
import {
  MediaGridSkeleton,
  MediaListSkeleton,
} from '@/components/features/media/skeletons'
import { PageHeader } from '@/components/layout/page-header'
import { filesFromList, useMediaPageState  } from '@/hooks/media'

export function MediaPage() {
  const {
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
  } = useMediaPageState()

  return (
    <div className="relative flex min-h-full flex-col" {...dropProps}>
      <DropOverlay isVisible={isDragging} />

      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          onUpload(filesFromList(e.target.files))
          e.currentTarget.value = ''
        }}
      />

      <PageHeader
        title="Media Library"
        breadcrumbs={[{ label: 'Media', isCurrent: true }]}
      />

      {/* One container for both toolbars, with a fixed height: the selection
          toolbar has no Input, so letting each branch size itself made the row
          shrink on select and the whole page jump. Only the contents swap. */}
      <MediaToolbar
        view={view}
        setView={setView}
        sortKey={sortKey}
        sortDir={sortDir}
        setSort={setSort}
        toggleSortDir={toggleSortDir}
        search={search}
        hasPermission={hasPermission}
        canUpload={canUpload}
        selectedList={selectedList}
        clearSelection={clearSelection}
        uploadProgress={uploadProgress}
        isUploading={isUploading}
        onBulkDelete={onBulkDelete}
        onBulkDownload={onBulkDownload}
        isBulkDeleting={isBulkDeleting}
        isDownloading={isDownloading}
        onExport={onExport}
        isExporting={isExporting}
        fileRef={fileRef}
        debouncedSearch={debouncedSearch}
        hasSelection={hasSelection}
      />

      {isLoading ? (
        view === 'list' ? (
          <MediaListSkeleton />
        ) : (
          <MediaGridSkeleton />
        )
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-large border border-dashed border-default-200 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UploadCloud size={22} />
          </span>
          <p className="text-sm font-semibold text-default-700">
            {search ? `No results for “${search}”` : 'No files yet'}
          </p>
          <p className="text-xs text-default-400">
            {canUpload
              ? 'Drag files here, or use the Upload button.'
              : 'Uploaded files will appear here.'}
          </p>
        </div>
      ) : (
        /* Rubber-band selection surface. `flex-1` gives the empty space below
           the last row something to start a drag on. */
        <div
          ref={marquee.containerRef}
          onMouseDown={marquee.onMouseDown}
          onClick={(e) => {
            // The click that ends a marquee drag must not wipe what the drag
            // just selected.
            if (marquee.wasDragging()) return
            // Otherwise a plain click on empty space clears, like Drive.
            const target = e.target as HTMLElement
            if (!target.closest('[data-item-id], button, a, input')) {
              clearSelection()
            }
          }}
          className="relative flex-1"
        >
          {view === 'list' ? (
            <div className="flex flex-col gap-2">
              {items.map((media) => (
                <MediaRow
                  key={media.id}
                  media={media}
                  actions={actions}
                  isSelected={selectedIds.has(media.id)}
                  onSelect={onSelectItem}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((media) => (
                <MediaCard
                  key={media.id}
                  media={media}
                  actions={actions}
                  isSelected={selectedIds.has(media.id)}
                  onSelect={onSelectItem}
                />
              ))}
            </div>
          )}

          {marquee.rect && (
            <div
              aria-hidden
              className="pointer-events-none absolute z-20 rounded-medium border border-primary bg-primary/10"
              style={{
                left: marquee.rect.left,
                top: marquee.rect.top,
                width: marquee.rect.width,
                height: marquee.rect.height,
              }}
            />
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            showControls
            size="sm"
            page={page}
            total={totalPages}
            onChange={onPageChange}
          />
        </div>
      )}

      <MediaDetailModal {...modalProps} />
    </div>
  )
}
