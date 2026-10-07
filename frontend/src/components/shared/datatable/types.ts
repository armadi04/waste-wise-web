import type { PaginatedData } from '@/types/api'
import type { SortDescriptor } from '@heroui/react'
import type React from 'react'

export interface Column<T> {
  name: string
  uid: string
  sortable?: boolean
  align?: 'start' | 'center' | 'end'
  /** Truncate cell text with ellipsis and show full content on hover */
  truncate?: boolean
  /** Max width in px for truncated cells (default: 200) */
  maxWidth?: number
  render?: (item: T) => React.ReactNode
  exportValue?: (item: T) => string | number | null
}

export interface DataTableProps<T extends { id: string | number }> {
  data?: PaginatedData<T>
  columns: Array<Column<T>>
  isLoading?: boolean
  onSearch?: (value: string) => void
  onSortChange?: (descriptor: SortDescriptor) => void
  onPageChange?: (page: number) => void
  onLimitChange?: (limit: number) => void
  limit?: number
  onCreate?: () => void
  /** Label for the built-in create button (defaults to "Add"). */
  createLabel?: string
  searchPlaceholder?: string
  emptyContent?: string
  initialSearch?: string
  sortDescriptor?: SortDescriptor
  headerSlot?: React.ReactNode
  /** Extra controls rendered at the start of the right toolbar group. */
  headerActions?: React.ReactNode
  /** Extra controls rendered after the create button, at the far right. */
  trailingActions?: React.ReactNode
  onExport?: () => void
  isExporting?: boolean
  /** Hide the Export button entirely (defaults to shown). */
  showExport?: boolean
  /** Row id with an in-flight mutation (e.g. delete) — dims + disables that row */
  pendingRowId?: string | number | null
  /** Show row checkboxes for bulk actions (default: true) */
  enableSelection?: boolean
  /**
   * Called with the selected row ids when the bulk Delete button is pressed.
   * Pass a callback only when the user may bulk-delete; omit it to hide the
   * button (e.g. no permission). `clearSelection` resets the checkboxes.
   */
  onBulkDelete?: (ids: Array<T['id']>, clearSelection: () => void) => void
}
