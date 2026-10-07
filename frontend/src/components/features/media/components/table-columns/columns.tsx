import type { Column } from '@/components/shared/datatable'
import type { Media } from '@/types/media'
import { formatBusinessDate as format, formatBytes } from '@/lib/utils/format'

/**
 * Column definitions for the Excel export only — the page itself renders a
 * Drive-style grid, not a DataTable, so these exist purely to shape the
 * spreadsheet `useExportExcel` writes.
 */
export const mediaExportColumns: Array<Column<Media>> = [
  { name: 'ID', uid: 'id' },
  { name: 'Filename', uid: 'originalName' },
  { name: 'Type', uid: 'mimetype' },
  {
    name: 'Size',
    uid: 'size',
    exportValue: (item) => formatBytes(item.size),
  },
  {
    name: 'Visibility',
    uid: 'isPrivate',
    exportValue: (item) => (item.isPrivate ? 'Private' : 'Public'),
  },
  { name: 'URL', uid: 'url' },
  {
    name: 'Created At',
    uid: 'createdAt',
    exportValue: (item) =>
      format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm:ss'),
  },
]
