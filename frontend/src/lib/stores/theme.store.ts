import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Theme store — single source of truth for dark/light mode.
 *
 * - State is persisted under the `theme-store` key via the `persist` middleware.
 * - A module-level subscription applies the side effect (toggling the `dark`
 *   class on <html>) so any state change anywhere reflects in the DOM.
 * - On first load (no persisted value) we seed from the legacy `theme` key and,
 *   failing that, the OS `prefers-color-scheme` setting.
 */

interface ThemeStore {
  isDark: boolean
  setTheme: (isDark: boolean) => void
  toggle: () => void
}

const getInitialDark = (): boolean => {
  if (typeof window === 'undefined') return false
  const legacy = localStorage.getItem('theme')
  if (legacy === 'dark' || legacy === 'light') return legacy === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      isDark: getInitialDark(),
      setTheme: (isDark) => set({ isDark }),
      toggle: () => set({ isDark: !get().isDark }),
    }),
    { name: 'theme-store' },
  ),
)

/** Reflect the store value onto the document element. */
const applyTheme = (isDark: boolean) => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', isDark)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', isDark ? '#000000' : '#FFFFFF')
}

// Apply once at module load, then on every change (fires synchronously inside `set`).
applyTheme(useThemeStore.getState().isDark)
useThemeStore.subscribe((state) => applyTheme(state.isDark))
