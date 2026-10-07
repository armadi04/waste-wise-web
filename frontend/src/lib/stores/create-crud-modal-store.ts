import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'

/**
 * Factory for per-feature UI stores that drive a feature's modals.
 *
 * Each feature (users, roles, …) gets one store created from this factory. A
 * store tracks, per named modal, its open flag, the entity being acted on, and
 * — for selection modals — the search text and the selected id set. Seeding the
 * selection happens centrally in `open()`, so modal components stay free of
 * reset-on-open effects.
 *
 * This is purely client UI state. Server data (lists, the entity's saved roles)
 * comes from react-query; forms use react-hook-form.
 */

export interface ModalSlot<TEntity> {
  isOpen: boolean
  entity: TEntity | null
  /** Free-text filter inside selection modals. */
  search: string
  /** Currently selected ids inside selection modals. */
  selected: Set<number>
}

export interface OpenOptions {
  readOnly?: boolean
  /** Initial selection (e.g. the entity's current role/permission ids). */
  selected?: Iterable<number>
}

export interface CrudModalStore<TEntity> {
  modals: Record<string, ModalSlot<TEntity>>
  /** Whether the currently open form modal is in view-only mode. */
  isReadOnly: boolean
  open: (modal: string, entity?: TEntity | null, opts?: OpenOptions) => void
  close: (modal: string) => void
  /** Curried handler matching HeroUI's `Modal.onOpenChange`. */
  onOpenChange: (modal: string) => (isOpen: boolean) => void
  setSearch: (modal: string, value: string) => void
  setSelected: (modal: string, selected: Set<number>) => void
  toggleSelected: (modal: string, id: number) => void
}

const emptySlot = <TEntity>(): ModalSlot<TEntity> => ({
  isOpen: false,
  entity: null,
  search: '',
  selected: new Set<number>(),
})

export function createCrudModalStore<TEntity>(
  modalNames: Array<string>,
): UseBoundStore<StoreApi<CrudModalStore<TEntity>>> {
  return create<CrudModalStore<TEntity>>((set) => ({
    modals: Object.fromEntries(modalNames.map((name) => [name, emptySlot<TEntity>()])),
    isReadOnly: false,

    open: (modal, entity = null, opts = {}) =>
      set((state) => ({
        isReadOnly: opts.readOnly ?? false,
        modals: {
          ...state.modals,
          [modal]: {
            isOpen: true,
            entity,
            search: '',
            selected: new Set(opts.selected ?? []),
          },
        },
      })),

    close: (modal) =>
      set((state) => ({
        modals: {
          ...state.modals,
          [modal]: { ...state.modals[modal], isOpen: false },
        },
      })),

    onOpenChange: (modal) => (isOpen) =>
      set((state) => ({
        modals: {
          ...state.modals,
          [modal]: { ...state.modals[modal], isOpen },
        },
      })),

    setSearch: (modal, value) =>
      set((state) => ({
        modals: {
          ...state.modals,
          [modal]: { ...state.modals[modal], search: value },
        },
      })),

    setSelected: (modal, selected) =>
      set((state) => ({
        modals: {
          ...state.modals,
          [modal]: { ...state.modals[modal], selected },
        },
      })),

    toggleSelected: (modal, id) =>
      set((state) => {
        const slot = state.modals[modal]
        const next = new Set(slot.selected)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return {
          modals: { ...state.modals, [modal]: { ...slot, selected: next } },
        }
      }),
  }))
}
