import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useThemeStore } from '@/lib/stores/theme.store'

/**
 * Reads and writes the app theme. Thin wrapper over {@link useThemeStore} kept
 * for call-site compatibility — the store is the single source of truth and
 * applies the DOM `dark` class via its own subscription.
 *
 * `toggleTheme` additionally plays the circular view-transition reveal,
 * expanding from `anchor` (the element that triggered it) or the viewport
 * centre when no anchor is given.
 */
export const useTheme = (duration = 400) => {
  const isDark = useThemeStore((s) => s.isDark)
  const setTheme = useThemeStore((s) => s.setTheme)

  const toggleTheme = useCallback(
    async (anchor?: Element | null) => {
      // Browsers without view transitions still need the theme to flip.
      if (
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        !('startViewTransition' in document)
      ) {
        useThemeStore.getState().toggle()
        return
      }

      // The store subscription toggles the `dark` class synchronously; running
      // it inside flushSync lets the transition capture before/after states.
      await document.startViewTransition(() => {
        flushSync(() => {
          useThemeStore.getState().toggle()
        })
      }).ready

      const rect = anchor?.getBoundingClientRect()
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2
      const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      )

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        },
      )
    },
    [duration],
  )

  return { isDark, setTheme, toggleTheme }
}
