import { create } from 'zustand'

/**
 * Page header store — lets a route publish its title + breadcrumb trail so the
 * top bar (Header) can render them on the left. The active page mounts a
 * `PageHeader`, which writes here on render and clears on unmount.
 *
 * Not persisted: this is ephemeral per-route UI state, not a preference.
 */

export interface HeaderBreadcrumb {
  label: string
  href?: string
  isCurrent?: boolean
}

interface PageHeaderStore {
  title: string
  breadcrumbs: Array<HeaderBreadcrumb>
  setHeader: (title: string, breadcrumbs: Array<HeaderBreadcrumb>) => void
  clear: () => void
}

export const usePageHeaderStore = create<PageHeaderStore>((set) => ({
  title: '',
  breadcrumbs: [],
  setHeader: (title, breadcrumbs) => set({ title, breadcrumbs }),
  clear: () => set({ title: '', breadcrumbs: [] }),
}))
