import { create } from 'zustand'

/**
 * Media grid selection — Drive-style click / ctrl-click / shift-range.
 *
 * Client state only: it holds ids, never Media objects (those stay in
 * react-query). `orderedIds` is passed in per interaction so the range anchor
 * follows whatever the grid is currently rendering.
 */

export interface SelectModifiers {
  /** ctrl (Windows/Linux) or cmd (macOS) — toggle one item. */
  meta?: boolean
  /** shift — extend from the anchor. */
  shift?: boolean
}

interface MediaSelectionState {
  selectedIds: Set<number>
  anchorId: number | null
  select: (
    id: number,
    modifiers: SelectModifiers,
    orderedIds: Array<number>,
  ) => void
  selectAll: (ids: Array<number>) => void
  /** Replace the whole selection — used by marquee dragging. */
  setSelection: (ids: Iterable<number>) => void
  clear: () => void
}

export const useMediaSelectionStore = create<MediaSelectionState>(
  (set, get) => ({
    selectedIds: new Set<number>(),
    anchorId: null,

    select: (id, modifiers, orderedIds) => {
      const { selectedIds, anchorId } = get()

      if (modifiers.shift && anchorId != null) {
        const from = orderedIds.indexOf(anchorId)
        const to = orderedIds.indexOf(id)
        if (from !== -1 && to !== -1) {
          const [start, end] = from <= to ? [from, to] : [to, from]
          set({ selectedIds: new Set(orderedIds.slice(start, end + 1)) })
          return
        }
      }

      if (modifiers.meta) {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        set({ selectedIds: next, anchorId: id })
        return
      }

      // Plain click replaces the selection and never deselects — re-clicking an
      // already-selected item must leave it selected, or the two clicks that
      // precede a dblclick would cancel each other out and opening would lose
      // the selection.
      set({ selectedIds: new Set([id]), anchorId: id })
    },

    selectAll: (ids) => set({ selectedIds: new Set(ids), anchorId: null }),

    setSelection: (ids) => set({ selectedIds: new Set(ids) }),

    clear: () => set({ selectedIds: new Set(), anchorId: null }),
  }),
)
