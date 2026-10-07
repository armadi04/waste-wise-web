import {
  Card,
  CardBody,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import type { DataTableProps } from '@/components/shared/datatable/types'
import { Pagination } from '@/components/shared/controls'
import { DataTableToolbar } from '@/components/shared/datatable/child/data-table-toolbar'
import { useDataTableState } from '@/hooks/global'

import { TruncatedCell } from '@/components/shared/datatable/child/truncated-cell'

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  isLoading = false,
  onSearch,
  onSortChange,
  onPageChange,
  onLimitChange,
  limit = 20,
  onCreate,
  createLabel = 'Add',
  searchPlaceholder = 'Search...',
  emptyContent = 'No data found.',
  initialSearch = '',
  sortDescriptor,
  headerSlot,
  headerActions,
  trailingActions,
  onExport,
  isExporting = false,
  showExport = true,
  pendingRowId,
  enableSelection = true,
  onBulkDelete,
}: DataTableProps<T>) {
  const {
    selectedKeys,
    setSelectedKeys,
    activePendingId,
    displayRows,
    selectedIds,
    clearSelection,
    visibleColumns,
    setVisibleColumns,
    headerColumns,
    handleSearch,
  } = useDataTableState<T>({
    data,
    columns,
    isLoading,
    onSearch,
    onSortChange,
    onPageChange,
    onLimitChange,
    limit,
    onCreate,
    createLabel,
    searchPlaceholder,
    emptyContent,
    initialSearch,
    sortDescriptor,
    headerSlot,
    headerActions,
    trailingActions,
    onExport,
    isExporting,
    showExport,
    pendingRowId,
    enableSelection,
    onBulkDelete,
  })

  return (
    <Card className="[view-transition-name:card-container] w-full bg-content1 border border-default-200 rounded-large shadow-none overflow-hidden mt-2">
      {/* Toolbar */}
      <DataTableToolbar
        limit={limit}
        onLimitChange={onLimitChange}
        selectedIds={selectedIds}
        clearSelection={clearSelection}
        handleSearch={handleSearch}
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
        onSearch={onSearch}
        searchPlaceholder={searchPlaceholder}
        data={data}
        initialSearch={initialSearch}
        headerSlot={headerSlot}
        enableSelection={enableSelection}
        onBulkDelete={onBulkDelete}
        headerActions={headerActions}
        columns={columns}
        onExport={onExport}
        isExporting={isExporting}
        showExport={showExport}
        onCreate={onCreate}
        createLabel={createLabel}
        trailingActions={trailingActions}
      />
      <CardBody className="p-0">
        {/* Table */}
        {isLoading ? (
          <Table
            aria-label="Loading data"
            shadow="none"
            checkboxesProps={{
              classNames: { base: 'app-choice', wrapper: 'app-choice-control' },
            }}
            classNames={{
              base: 'px-0 pb-0',
              wrapper: 'bg-transparent shadow-none p-0 rounded-large',
              table: 'app-table text-sm tabular-nums',
              thead: 'bg-default-50',
              th: 'bg-[var(--app-muted)] text-default-500 font-semibold text-sm border-b border-default-200 h-11 rounded-none first:pl-4 last:pr-4',
              td: 'py-3 border-b border-default-200 group-last:border-none first:pl-4 last:pr-4',
              tr: 'group hover:bg-default-50 transition-colors',
            }}
          >
            <TableHeader columns={headerColumns}>
              {(column) => (
                <TableColumn
                  key={column.uid}
                  allowsSorting={column.sortable}
                  align={column.align}
                >
                  {column.name}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {headerColumns.map((column) => (
                    <TableCell
                      key={column.uid}
                      className={
                        column.align === 'end' ? 'text-right' : undefined
                      }
                    >
                      <Skeleton className="rounded-large">
                        <div className="h-3 w-4/5 rounded-large bg-default-200"></div>
                      </Skeleton>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table
            aria-label="Data table"
            shadow="none"
            checkboxesProps={{
              classNames: { base: 'app-choice', wrapper: 'app-choice-control' },
            }}
            classNames={{
              base: 'px-0 pb-0',
              wrapper: 'bg-transparent shadow-none p-0 rounded-large',
              table: 'app-table text-sm tabular-nums',
              thead: 'bg-default-50',
              th: 'bg-[var(--app-muted)] text-default-500 font-semibold text-sm border-b border-default-200 h-11 rounded-none first:pl-4 last:pr-4',
              td: 'py-3 border-b border-default-200 group-last:border-none first:pl-4 last:pr-4',
              tr: 'group hover:bg-default-50 transition-colors data-[selected=true]:bg-[var(--app-selected-background)]',
            }}
            selectionMode={enableSelection ? 'multiple' : 'none'}
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
            color="primary"
            sortDescriptor={sortDescriptor}
            onSortChange={onSortChange}
            bottomContent={
              data?.meta?.lastPage && data.meta.lastPage > 1 ? (
                <div className="flex w-full justify-end p-3 border-t border-default-200">
                  <Pagination
                    isCompact
                    showControls
                    color="primary"
                    page={data.meta.page}
                    total={data.meta.lastPage}
                    onChange={onPageChange}
                  />
                </div>
              ) : null
            }
          >
            <TableHeader columns={headerColumns}>
              {(column) => (
                <TableColumn
                  key={column.uid}
                  allowsSorting={column.sortable}
                  align={column.align}
                >
                  {column.name}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody emptyContent={emptyContent} items={displayRows}>
              {(item) => {
                const isPending =
                  activePendingId != null && item.id === activePendingId
                return (
                  <TableRow
                    key={item.id}
                    className={
                      isPending
                        ? 'app-status-danger bg-[var(--app-danger-background)] pointer-events-none transition-colors'
                        : 'transition-colors'
                    }
                  >
                    {(columnKey) => {
                      const column = columns.find((c) => c.uid === columnKey)
                      // While a row's delete is in flight, replace every cell with
                      // a shimmering skeleton (same treatment as the table's own
                      // loading state) so the row reads as "being removed".
                      if (isPending) {
                        return (
                          <TableCell>
                            <Skeleton className="rounded-large">
                              <div className="h-3 w-4/5 rounded-large bg-default-200" />
                            </Skeleton>
                          </TableCell>
                        )
                      }
                      const raw = column?.render
                        ? column.render(item)
                        : (item as any)[columnKey]
                      return (
                        <TableCell
                          className={
                            column?.align === 'end' ? 'text-right' : undefined
                          }
                        >
                          {column?.truncate ? (
                            <TruncatedCell maxWidth={column.maxWidth}>
                              {raw}
                            </TruncatedCell>
                          ) : (
                            raw
                          )}
                        </TableCell>
                      )
                    }}
                  </TableRow>
                )
              }}
            </TableBody>
          </Table>
        )}
      </CardBody>
    </Card>
  )
}
