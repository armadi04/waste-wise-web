// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DataTableProps } from '@/components/shared/datatable/types'
import { useDataTableState } from '@/hooks/global/use-data-table-state'

type Row = { id: number; label: string }
const row: Row = { id: 1, label: 'First' }
const props = (rows: Array<Row>): DataTableProps<Row> => ({
  data: { data: rows, meta: { total: rows.length, page: 1, lastPage: 1 } },
  columns: [{ uid: 'label', name: 'Label' }],
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('table state across updates', () => {
  it('retains a removed pending row until the existing highlight interval ends', () => {
    vi.useFakeTimers()
    const initialProps: DataTableProps<Row> = {
      ...props([row]),
      pendingRowId: 1,
    }
    const { result, rerender } = renderHook(useDataTableState<Row>, {
      initialProps,
    })
    expect(result.current.activePendingId).toBe(1)
    expect(result.current.displayRows[0]).toEqual(row)
    expect(result.current.displayRows[0]).not.toBe(row)
    rerender({ ...props([]), pendingRowId: null })
    act(() => vi.advanceTimersByTime(549))
    expect(result.current.displayRows).toEqual([row])
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.activePendingId).toBeNull()
    expect(result.current.displayRows).toEqual([])
  })

  it('clears selected ids when a different page becomes visible', () => {
    const { result, rerender } = renderHook(useDataTableState<Row>, {
      initialProps: props([row]),
    })
    act(() => result.current.setSelectedKeys(new Set(['1'])))
    expect(result.current.selectedIds).toEqual([1])
    rerender(props([{ id: 2, label: 'Second' }]))
    expect(result.current.selectedIds).toEqual([])
  })

  it('reveals newly available columns without restoring manually hidden columns', () => {
    const { result, rerender } = renderHook(useDataTableState<Row>, {
      initialProps: props([row]),
    })
    act(() => result.current.setVisibleColumns(new Set()))
    rerender({
      ...props([row]),
      columns: [...props([row]).columns, { uid: 'id', name: 'ID' }],
    })
    expect(result.current.headerColumns.map((column) => column.uid)).toEqual([
      'id',
    ])
  })
})
