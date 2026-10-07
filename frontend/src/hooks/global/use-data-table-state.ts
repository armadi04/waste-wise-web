import React from 'react'
import type { DataTableProps } from '@/components/shared/datatable/types'
import type { Selection } from '@heroui/react'
import { useTimeZone } from '@/lib/stores/time-zone'

export function useDataTableState<T extends { id: string | number }>({
  data,
  columns,
  onSearch,
  pendingRowId,
}: DataTableProps<T>) {
  useTimeZone((s) => s.timeZone)

  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [selectedKeys, setSelectedKeys] = React.useState<Selection>(new Set())

  // Keep a row highlighted from the moment its mutation starts, held for at
  // least MIN_MS so a fast (localhost) delete doesn't flip `pendingRowId` back
  // to null before the eye can register the highlight. After the minimum window
  // it clears once the mutation is no longer pending — whether the row was
  // removed (success) or survived the refetch (failure).
  const MIN_MS = 550

  const [stickyPendingId, setStickyPendingId] = React.useState<
    string | number | null
  >(null)

  const startedAt = React.useRef(0)

  React.useEffect(() => {
    if (pendingRowId != null) {
      startedAt.current = Date.now()
      setStickyPendingId(pendingRowId)
    }
  }, [pendingRowId])

  React.useEffect(() => {
    if (stickyPendingId == null || pendingRowId != null) return
    const elapsed = Date.now() - startedAt.current
    const t = setTimeout(
      () => setStickyPendingId(null),
      Math.max(0, MIN_MS - elapsed),
    )
    return () => clearTimeout(t)
  }, [pendingRowId, stickyPendingId])

  const activePendingId = stickyPendingId

  // Retain the last rendered rows so a pending row that the post-delete refetch
  // already dropped can be re-injected (at its old position) for the remainder
  // of the highlight window — otherwise it unmounts before the eye sees it.
  const rows = data?.data || []

  const lastRowsRef = React.useRef<Array<T>>(rows)

  React.useEffect(() => {
    lastRowsRef.current = rows
  })

  // The pending row must get a FRESH object identity, held stable for the whole
  // highlight window. HeroUI's collection (react-stately CollectionBuilder)
  // caches built nodes in a WeakMap keyed by the item object and skips re-running
  // the row renderer when the item identity is unchanged — and react-query's
  // keepPreviousData keeps row references stable across refetches. So a plain
  // className toggle never re-renders; swapping in a clone (same id, new object)
  // forces a cache miss so the pending className is actually applied. On failure
  // (or once the window ends) we drop the clone and the cached non-pending node
  // returns.
  const pendingCloneRef = React.useRef<{ id: string | number; row: T } | null>(
    null,
  )

  const displayRows = React.useMemo(() => {
    if (activePendingId == null) {
      pendingCloneRef.current = null
      return rows
    }
    const inCurrent = rows.find((r) => r.id === activePendingId)
    const source =
      inCurrent ?? lastRowsRef.current.find((r) => r.id === activePendingId)
    if (!source) return rows
    if (pendingCloneRef.current?.id !== activePendingId) {
      pendingCloneRef.current = { id: activePendingId, row: { ...source } }
    }
    const clone = pendingCloneRef.current.row
    if (inCurrent) {
      return rows.map((r) => (r.id === activePendingId ? clone : r))
    }
    const idx = lastRowsRef.current.findIndex((r) => r.id === activePendingId)
    const next = [...rows]
    next.splice(Math.min(Math.max(idx, 0), next.length), 0, clone)
    return next
  }, [rows, activePendingId])

  const selectedIds = React.useMemo<Array<T['id']>>(() => {
    if (selectedKeys === 'all') return rows.map((r) => r.id)
    return rows
      .filter((r) => (selectedKeys as Set<React.Key>).has(String(r.id)))
      .map((r) => r.id)
  }, [selectedKeys, rows])

  const clearSelection = React.useCallback(() => setSelectedKeys(new Set()), [])

  // Drop selection whenever the visible rows change (page, search, limit, or a
  // delete) so ids from a previous view can never leak into a bulk action.
  const rowIdsKey = rows.map((r) => r.id).join(',')

  React.useEffect(() => {
    setSelectedKeys(new Set())
  }, [rowIdsKey])

  // Initialize visible columns with all column UIDs
  const [visibleColumns, setVisibleColumns] = React.useState<Selection>(
    new Set(columns.map((c) => c.uid)),
  )

  // Reveal columns that appear after mount (e.g. permission-gated ones) without
  // clobbering the user's manual hides — only newly-added uids get added to the
  // visible set (finding #23).
  const knownColumnUids = React.useRef(new Set(columns.map((c) => c.uid)))

  React.useEffect(() => {
    const added = columns
      .map((c) => c.uid)
      .filter((uid) => !knownColumnUids.current.has(uid))
    if (added.length === 0) return
    added.forEach((uid) => knownColumnUids.current.add(uid))
    setVisibleColumns((prev) =>
      prev === 'all' ? prev : new Set([...prev, ...added]),
    )
  }, [columns])

  const headerColumns = React.useMemo(() => {
    if (visibleColumns === 'all') return columns

    return columns.filter((column) =>
      Array.from(visibleColumns).includes(column.uid),
    )
  }, [visibleColumns, columns])

  const handleSearch = (value: string) => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current)
    }

    searchTimeout.current = setTimeout(() => {
      onSearch?.(value)
    }, 500)
  }
  return {
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
  }
}
