import { useBackgroundStore } from '@/lib/stores/background.store'

export type { BackgroundStyle } from '@/lib/stores/background.store'

/**
 * Reads the current background preference and exposes a setter. Thin wrapper
 * over {@link useBackgroundStore}; the store applies the `data-background`
 * attribute via its own subscription, so no init hook is required.
 */
export const useBackground = () => {
  const style = useBackgroundStore((s) => s.style)
  const setBackground = useBackgroundStore((s) => s.setBackground)
  return { style, setBackground }
}
