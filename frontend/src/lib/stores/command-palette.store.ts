import { create } from 'zustand'

/**
 * Command palette store — owns nothing but the open/close state so the header
 * trigger, the global ⌘K listener and the palette itself stay decoupled. The
 * command list is derived (permission-filtered) in `useCommandPalette`.
 */

interface CommandPaletteStore {
  isOpen: boolean
  setIsOpen: (value: boolean) => void
  open: () => void
  close: () => void
  toggle: () => void
}

export const useCommandPaletteStore = create<CommandPaletteStore>()((set, get) => ({
  isOpen: false,
  setIsOpen: (value) => set({ isOpen: value }),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen }),
}))
