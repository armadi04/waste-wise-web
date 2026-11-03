import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syncThemeColor } from '@/lib/theme/appearance'

/**
 * Background store — controls the app background style.
 *
 * - State is persisted under the `background-store` key via `persist`.
 * - A module-level subscription applies the `data-background` attribute on <html>.
 * - On first load (no persisted value) we seed from the legacy `background` key.
 */

export type BackgroundStyle = 'gradient' | 'neutral' | 'gray'

const VALID_STYLES: ReadonlyArray<BackgroundStyle> = [
  'gradient',
  'neutral',
  'gray',
]

const isBackgroundStyle = (value: unknown): value is BackgroundStyle =>
  typeof value === 'string' &&
  (VALID_STYLES as ReadonlyArray<string>).includes(value)

interface BackgroundStore {
  style: BackgroundStyle
  setBackground: (style: BackgroundStyle) => void
}

export const getInitialStyle = (): BackgroundStyle => {
  if (typeof window === 'undefined') return 'gradient'
  try {
    const saved = JSON.parse(localStorage.getItem('background-store') || 'null')
    if (isBackgroundStyle(saved?.state?.style)) return saved.state.style
    const legacy = localStorage.getItem('background')
    if (isBackgroundStyle(legacy)) return legacy
  } catch {
    /* Storage may be unavailable or malformed. */
  }
  return 'gradient'
}

export const useBackgroundStore = create<BackgroundStore>()(
  persist(
    (set) => ({
      style: getInitialStyle(),
      setBackground: (style) => set({ style }),
    }),
    {
      name: 'background-store',
      version: 1,
      migrate: (persisted) => persisted as BackgroundStore,
      merge: (persisted, current) => {
        const saved = persisted as Partial<BackgroundStore> | undefined
        return {
          ...current,
          style: isBackgroundStyle(saved?.style) ? saved.style : current.style,
        }
      },
    },
  ),
)

const applyBackground = (style: BackgroundStyle) => {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-background', style)
  syncThemeColor()
}

applyBackground(useBackgroundStore.getState().style)
useBackgroundStore.subscribe((state) => applyBackground(state.style))
