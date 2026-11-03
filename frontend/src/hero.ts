import { heroui } from '@heroui/react'
import { themeColors } from './lib/theme/palette'

// Palette lives in `src/lib/theme/palette.ts`; regenerate CSS tokens with
// `bun run tokens:generate` after changing it.
export default heroui({
  themes: {
    light: { colors: themeColors.light },
    dark: { colors: themeColors.dark },
  },
  layout: { radius: { small: '10px', medium: '12px', large: '16px' } },
})
