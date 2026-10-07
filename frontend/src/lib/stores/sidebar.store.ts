import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
} from '@/lib/constants/sidebar'

/**
 * Sidebar store — holds the collapse preference (persisted under `sidebar`).
 * The pixel width is derived, never stored, to avoid drift. Route-derived
 * concerns (active item, expanded groups) live in `useSidebarLogic`.
 */

interface SidebarStore {
  isCollapsed: boolean
  setIsCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void
  toggleSidebar: () => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set, get) => ({
      isCollapsed: false,
      setIsCollapsed: (value) =>
        set({
          isCollapsed:
            typeof value === 'function' ? value(get().isCollapsed) : value,
        }),
      toggleSidebar: () => set({ isCollapsed: !get().isCollapsed }),
    }),
    { name: 'sidebar' },
  ),
)

/** Full sidebar API (compat with the previous context hook shape). */
export const useSidebar = () => {
  const isCollapsed = useSidebarStore((s) => s.isCollapsed)
  const setIsCollapsed = useSidebarStore((s) => s.setIsCollapsed)
  const toggleSidebar = useSidebarStore((s) => s.toggleSidebar)
  return {
    isCollapsed,
    setIsCollapsed,
    toggleSidebar,
    sidebarWidth: isCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : SIDEBAR_EXPANDED_WIDTH,
  }
}

export const useSidebarWidth = () =>
  useSidebarStore((s) =>
    s.isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
  )

export const useSidebarCollapsed = () => useSidebarStore((s) => s.isCollapsed)
