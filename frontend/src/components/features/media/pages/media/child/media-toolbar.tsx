import { DropdownMenu, DropdownTrigger, Tab } from '@heroui/react'

import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpNarrowWide,
  Download,
  FileSpreadsheet,
  LayoutGrid,
  List,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { MediaSortKey } from '@/lib/schemas/media'
import type { useMediaPageState } from '@/hooks/media/use-media-page-state'
import {
  Button,
  Dropdown,
  DropdownItem,
  Input,
  Tabs,
} from '@/components/shared/controls'
import { SORT_LABELS } from '@/components/features/media/pages/media/lib/media-page-helpers'
import { MEDIA_SORT_KEYS } from '@/lib/schemas/media'

type Props = Pick<
  ReturnType<typeof useMediaPageState>,
  | 'view'
  | 'setView'
  | 'sortKey'
  | 'sortDir'
  | 'setSort'
  | 'toggleSortDir'
  | 'search'
  | 'hasPermission'
  | 'canUpload'
  | 'selectedList'
  | 'clearSelection'
  | 'uploadProgress'
  | 'isUploading'
  | 'onBulkDelete'
  | 'onBulkDownload'
  | 'isBulkDeleting'
  | 'isDownloading'
  | 'onExport'
  | 'isExporting'
  | 'fileRef'
  | 'debouncedSearch'
  | 'hasSelection'
>
export function MediaToolbar({
  view,
  setView,
  sortKey,
  sortDir,
  setSort,
  toggleSortDir,
  search,
  hasPermission,
  canUpload,
  selectedList,
  clearSelection,
  uploadProgress,
  isUploading,
  onBulkDelete,
  onBulkDownload,
  isBulkDeleting,
  isDownloading,
  onExport,
  isExporting,
  fileRef,
  debouncedSearch,
  hasSelection,
}: Props) {
  return (
    <div className="mb-4 flex min-h-10 flex-wrap items-center gap-2">
      {hasSelection ? (
        <>
          <span className="text-sm font-medium text-default-700">
            {selectedList.length} selected
          </span>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="bordered"
              className="border-default-200"
              startContent={!isDownloading && <Download size={16} />}
              isLoading={isDownloading}
              onPress={() => void onBulkDownload()}
            >
              Download
            </Button>
            {hasPermission('media.delete') && (
              <Button
                size="sm"
                color="danger"
                variant="flat"
                startContent={!isBulkDeleting && <Trash2 size={16} />}
                isLoading={isBulkDeleting}
                onPress={() => void onBulkDelete()}
              >
                Delete
              </Button>
            )}
            <Button
              size="sm"
              variant="light"
              startContent={<X size={16} />}
              onPress={clearSelection}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <Input
            isClearable
            size="sm"
            placeholder="Search files..."
            startContent={<Search size={16} className="text-default-400" />}
            defaultValue={search}
            onValueChange={debouncedSearch}
            className="w-full sm:max-w-xs"
            classNames={{
              inputWrapper:
                'border border-default-200 bg-background shadow-none data-[hover=true]:bg-background group-data-[focus=true]:border-primary',
            }}
          />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-1">
              <Dropdown
                placement="bottom-end"
                classNames={{ content: 'shadow-xl' }}
              >
                <DropdownTrigger>
                  <Button
                    size="sm"
                    variant="bordered"
                    aria-label={`Sort by ${SORT_LABELS[sortKey]}`}
                    startContent={<ArrowUpDown size={15} />}
                    className="border-default-200 min-w-8 px-2 sm:px-3"
                  >
                    <span className="hidden sm:inline">
                      {SORT_LABELS[sortKey]}
                    </span>
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Sort by"
                  selectionMode="single"
                  selectedKeys={[sortKey]}
                  onSelectionChange={(keys) => {
                    const next = Array.from(keys)[0] as MediaSortKey | undefined
                    if (next) setSort(next)
                  }}
                >
                  {MEDIA_SORT_KEYS.map((key) => (
                    <DropdownItem key={key}>{SORT_LABELS[key]}</DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
              <Button
                isIconOnly
                size="sm"
                variant="bordered"
                className="border-default-200"
                aria-label={
                  sortDir === 'asc' ? 'Sort descending' : 'Sort ascending'
                }
                onPress={toggleSortDir}
              >
                {sortDir === 'asc' ? (
                  <ArrowUpNarrowWide size={15} />
                ) : (
                  <ArrowDownWideNarrow size={15} />
                )}
              </Button>
            </div>
            <Tabs
              size="sm"
              aria-label="View"
              selectedKey={view}
              onSelectionChange={(key) => setView(key as 'grid' | 'list')}
            >
              <Tab
                key="grid"
                title={
                  <span className="flex items-center" aria-label="Card view">
                    <LayoutGrid size={15} />
                  </span>
                }
              />
              <Tab
                key="list"
                title={
                  <span className="flex items-center" aria-label="List view">
                    <List size={15} />
                  </span>
                }
              />
            </Tabs>
            <Button
              size="sm"
              variant="bordered"
              aria-label="Export to Excel"
              className="border-default-200 min-w-8 px-2 sm:px-3"
              startContent={!isExporting && <FileSpreadsheet size={16} />}
              isLoading={isExporting}
              onPress={() => void onExport()}
            >
              <span className="hidden sm:inline">Export</span>
            </Button>
            {canUpload && (
              <Button
                size="sm"
                color="primary"
                className="shrink-0"
                startContent={!isUploading && <Upload size={16} />}
                isLoading={isUploading}
                onPress={() => fileRef.current?.click()}
              >
                {uploadProgress
                  ? `Uploading ${uploadProgress.done}/${uploadProgress.total}`
                  : 'Upload'}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
