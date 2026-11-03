import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syncThemeColor } from '@/lib/theme/appearance'

/**
 * Theme store — single source of truth for dark/light mode.
 *
 * - State is persisted under the `theme-store` key via the `persist` middleware.
 * - A module-level subscription applies the side effect (applying the `light` or `dark`
 *   class on <html>) so any state change anywhere reflects in the DOM.
 * - On first load (no persisted value) we seed from the legacy `theme` key and,
 *   failing that, the OS `prefers-color-scheme` setting.
 */

interface ThemeStore {
  isDark: boolean
  setTheme: (isDark: boolean) => void
  toggle: () => void
}

export const getInitialDark = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    const saved = JSON.parse(localStorage.getItem('theme-store') || 'null')
    if (typeof saved?.state?.isDark === 'boolean') return saved.state.isDark
    const legacy = localStorage.getItem('theme')
    if (legacy === 'dark' || legacy === 'light') return legacy === 'dark'
  } catch {
    /* Storage may be unavailable or malformed. */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      isDark: getInitialDark(),
      setTheme: (isDark) => set({ isDark }),
      toggle: () => set({ isDark: !get().isDark }),
    }),
    {
      name: 'theme-store',
      version: 1,
      migrate: (persisted) => persisted as ThemeStore,
      merge: (persisted, current) => {
        const saved = persisted as Partial<ThemeStore> | undefined
        return {
          ...current,
          isDark:
            typeof saved?.isDark === 'boolean' ? saved.isDark : current.isDark,
        }
      },
    },
  ),
)

/** Reflect the store value onto the document element. */
const applyTheme = (isDark: boolean) => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(isDark ? 'dark' : 'light')
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  syncThemeColor()
}

// Apply once at module load, then on every change (fires synchronously inside `set`).
applyTheme(useThemeStore.getState().isDark)
useThemeStore.subscribe((state) => applyTheme(state.isDark))
