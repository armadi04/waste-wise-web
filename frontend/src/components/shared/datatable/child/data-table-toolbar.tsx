import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
} from '@heroui/react'
import { ChevronDown, FileOutput, Plus, Search, Trash2 } from 'lucide-react'
import type { DataTableProps } from '@/components/shared/datatable/types'
import type { useDataTableState } from '@/hooks/global/use-data-table-state'

type Props<T extends { id: string | number }> = Pick<
  ReturnType<typeof useDataTableState<T>>,
  | 'selectedIds'
  | 'clearSelection'
  | 'handleSearch'
  | 'visibleColumns'
  | 'setVisibleColumns'
> &
  Pick<
    DataTableProps<T>,
    | 'limit'
    | 'onLimitChange'
    | 'onSearch'
    | 'searchPlaceholder'
    | 'data'
    | 'initialSearch'
    | 'headerSlot'
    | 'enableSelection'
    | 'onBulkDelete'
    | 'headerActions'
    | 'columns'
    | 'onExport'
    | 'isExporting'
    | 'showExport'
    | 'onCreate'
    | 'createLabel'
    | 'trailingActions'
  >

export function DataTableToolbar<T extends { id: string | number }>({
  limit,
  onLimitChange,
  selectedIds,
  clearSelection,
  handleSearch,
  visibleColumns,
  setVisibleColumns,
  onSearch,
  searchPlaceholder,
  data,
  initialSearch,
  headerSlot,
  enableSelection,
  onBulkDelete,
  headerActions,
  columns,
  onExport,
  isExporting,
  showExport,
  onCreate,
  createLabel,
  trailingActions,
}: Props<T>) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border-b border-default-200">
      <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1">
        {/* Only render the search control when a handler is wired — an inert
              box on a static table is misleading (finding #24). */}
        {onSearch && (
          <Input
            placeholder={searchPlaceholder}
            size="sm"
            startContent={<Search size={16} className="text-default-400" />}
            endContent={
              <div className="flex items-center justify-center bg-default-100 rounded-large shrink-0 h-6 min-w-6 px-1.5">
                <span className="text-xs font-semibold text-default-600">
                  {data?.meta?.total || 0}
                </span>
              </div>
            }
            type="search"
            defaultValue={initialSearch}
            onValueChange={handleSearch}
            className="w-full sm:max-w-xs"
            classNames={{
              inputWrapper:
                'pr-1 border border-default-200 bg-background shadow-none data-[hover=true]:bg-background group-data-[focus=true]:border-primary',
            }}
          />
        )}
        {headerSlot && (
          <div className="flex items-center gap-2 shrink-0">{headerSlot}</div>
        )}
        {/* Bulk-action controls, inline with the search bar */}
        {enableSelection && selectedIds.length > 0 && (
          <div className="flex h-8 items-center gap-1.5 shrink-0 rounded-large border border-default-200 bg-background pl-3 pr-1">
            <span className="text-xs text-default-500 whitespace-nowrap">
              <span className="font-semibold text-foreground">
                {selectedIds.length}
              </span>{' '}
              selected
            </span>
            {onBulkDelete && (
              <Button
                size="sm"
                color="danger"
                variant="light"
                className="h-6 min-w-0 px-2"
                startContent={<Trash2 size={14} />}
                onPress={() => onBulkDelete(selectedIds, clearSelection)}
              >
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-start sm:justify-end">
        {headerActions}
        <Dropdown classNames={{ content: 'shadow-xl' }}>
          <DropdownTrigger>
            <Button
              size="sm"
              variant="bordered"
              endContent={
                <ChevronDown size={14} className="text-default-400" />
              }
              className="border-default-200 min-w-16"
            >
              {limit}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Rows per page"
            onAction={(key) => onLimitChange?.(Number(key))}
            selectedKeys={new Set([String(limit)])}
            selectionMode="single"
          >
            <DropdownItem key="10">10</DropdownItem>
            <DropdownItem key="20">20</DropdownItem>
            <DropdownItem key="30">30</DropdownItem>
            <DropdownItem key="50">50</DropdownItem>
          </DropdownMenu>
        </Dropdown>
        <Dropdown classNames={{ content: 'shadow-xl' }}>
          <DropdownTrigger>
            <Button
              size="sm"
              variant="bordered"
              endContent={
                <ChevronDown size={14} className="text-default-400" />
              }
              className="border-default-200"
            >
              Columns
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            disallowEmptySelection
            aria-label="Toggle columns"
            closeOnSelect={false}
            selectedKeys={visibleColumns}
            selectionMode="multiple"
            onSelectionChange={setVisibleColumns}
          >
            {columns.map((column) => (
              <DropdownItem key={column.uid} className="capitalize">
                {column.name}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        {showExport && (
          <Button
            size="sm"
            variant="bordered"
            startContent={!isExporting && <FileOutput size={14} />}
            className="border-default-200"
            onPress={onExport}
            isLoading={isExporting}
            isDisabled={
              !onExport || isExporting || (data?.meta?.total ?? 0) === 0
            }
          >
            Export
          </Button>
        )}
        {onCreate && (
          <Button
            size="sm"
            color="primary"
            startContent={<Plus size={16} />}
            onPress={onCreate}
          >
            {createLabel}
          </Button>
        )}
        {trailingActions}
      </div>
    </div>
  )
}
