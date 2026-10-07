import { useCallback, useState } from 'react'
import type { Column } from '@/components/shared/datatable'
import { displayTimeZone } from '@/lib/stores/time-zone'
import { parseBusinessDate } from '@/lib/utils/business-time'
import { formatBusinessDate } from '@/lib/utils/format'

interface UseExportExcelOptions<T> {
  filename: string
  sheetName?: string
  columns: Array<Column<T>>
  fetchAll: () => Promise<Array<T>>
}

export function useExportExcel<T>({
  filename,
  sheetName = 'Sheet1',
  columns,
  fetchAll,
}: UseExportExcelOptions<T>) {
  const [isExporting, setIsExporting] = useState(false)

  const onExport = useCallback(async () => {
    setIsExporting(true)
    try {
      // `xlsx` is ~450 kB and only needed once the user actually exports.
      const [XLSX, items] = await Promise.all([import('xlsx'), fetchAll()])
      const exportColumns = columns.filter(
        (col) => col.uid !== 'actions' && col.uid !== 'preview',
      )

      const worksheetData = items.map((item) => {
        const row: Record<string, string | number | null> = {}
        for (const col of exportColumns) {
          row[col.name] = col.exportValue
            ? col.exportValue(item)
            : (((item as Record<string, unknown>)[col.uid] as
                string | number | null) ?? null)
        }
        row['Time zone'] = displayTimeZone()
        for (const [key, value] of Object.entries(
          item as Record<string, unknown>,
        )) {
          if (
            typeof value === 'string' &&
            Number.isFinite(parseBusinessDate(value).getTime())
          )
            row[`${key} (UTC)`] = parseBusinessDate(value).toISOString()
        }
        return row
      })

      const worksheet = XLSX.utils.json_to_sheet(worksheetData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

      if (worksheetData.length > 0) {
        worksheet['!cols'] = Object.keys(worksheetData[0]).map((key) => ({
          wch: Math.max(key.length, 10) + 5,
        }))
      }

      const date = formatBusinessDate(new Date(), 'yyyy-MM-dd')
      XLSX.writeFile(workbook, `${filename}_${date}.xlsx`)
    } finally {
      setIsExporting(false)
    }
  }, [columns, fetchAll, filename, sheetName])

  return { onExport, isExporting }
}
