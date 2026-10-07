import { create } from 'zustand'
import type React from 'react'

/**
 * Confirmation store — a promise-based confirm dialog usable anywhere, with no
 * provider. `confirm(options)` returns a Promise that resolves to the user's
 * choice; the pending resolver is held in the store and settled by
 * `handleConfirm` / `handleCancel`. A single mounted `<ConfirmationRoot />`
 * renders the actual modal.
 */

export type ConfirmationOptions = {
  title?: string
  message?: string | React.ReactNode
  confirmText?: string
  cancelText?: string
  color?: 'primary' | 'danger' | 'success' | 'warning' | 'default'
}

interface ConfirmationStore {
  isOpen: boolean
  options: ConfirmationOptions
  _resolve: ((value: boolean) => void) | null
  confirm: (options: ConfirmationOptions) => Promise<boolean>
  handleConfirm: () => void
  handleCancel: () => void
}

export const useConfirmationStore = create<ConfirmationStore>((set, get) => ({
  isOpen: false,
  options: {},
  _resolve: null,
  confirm: (options) =>
    new Promise<boolean>((resolve) =>
      set({ isOpen: true, options, _resolve: resolve }),
    ),
  handleConfirm: () => {
    get()._resolve?.(true)
    set({ isOpen: false, _resolve: null })
  },
  handleCancel: () => {
    get()._resolve?.(false)
    set({ isOpen: false, _resolve: null })
  },
}))
