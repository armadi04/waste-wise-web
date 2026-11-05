import { describe, expect, it } from 'vitest'
import type { ThemeName } from '@/lib/theme/palette'
import { appTokens } from '@/lib/theme/palette'

const luminance = (hex: string) => {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

const contrast = (foreground: string, background: string) => {
  const a = luminance(foreground)
  const b = luminance(background)
  const [high, low] = a > b ? [a, b] : [b, a]
  return (high + 0.05) / (low + 0.05)
}

const TEXT = 4.5
const NON_TEXT = 3

type Pair = [label: string, foreground: string, background: string, min: number]

const textPairs: Array<[string, string, string]> = [
  ['foreground/background', 'foreground', 'background'],
  ['foreground/surface', 'foreground', 'surface'],
  ['muted-foreground/muted', 'muted-foreground', 'muted'],
  ['muted-foreground/background', 'muted-foreground', 'background'],
  ['link/background', 'link', 'background'],
  ['primary-foreground/primary', 'primary-foreground', 'primary'],
  [
    'selected-foreground/selected-background',
    'selected-foreground',
    'selected-background',
  ],
  ['input-foreground/input-background', 'input-foreground', 'input-background'],
  [
    'input-placeholder/input-background',
    'input-placeholder',
    'input-background',
  ],
  [
    'success-foreground/success-background',
    'success-foreground',
    'success-background',
  ],
  [
    'warning-foreground/warning-background',
    'warning-foreground',
    'warning-background',
  ],
  [
    'danger-foreground/danger-background',
    'danger-foreground',
    'danger-background',
  ],
  ['info-foreground/info-background', 'info-foreground', 'info-background'],
  [
    'success-solid-foreground/success-solid',
    'success-solid-foreground',
    'success-solid',
  ],
  [
    'warning-solid-foreground/warning-solid',
    'warning-solid-foreground',
    'warning-solid',
  ],
  [
    'danger-solid-foreground/danger-solid',
    'danger-solid-foreground',
    'danger-solid',
  ],
  ['info-solid-foreground/info-solid', 'info-solid-foreground', 'info-solid'],
]

const nonTextPairs: Array<[string, string, string]> = [
  ['focus/background', 'focus', 'background'],
  ['focus/surface', 'focus', 'surface'],
  ['border-control/background', 'border-control', 'background'],
  ['input-border/input-background', 'input-border', 'input-background'],
  [
    'input-border-focus/input-background',
    'input-border-focus',
    'input-background',
  ],
  [
    'selected-border/selected-background',
    'selected-border',
    'selected-background',
  ],
]

describe.each<ThemeName>(['light', 'dark'])('WCAG contrast (%s)', (theme) => {
  const tokens = appTokens[theme]

  it.each<Pair>(
    textPairs.map(([label, foreground, background]) => [
      label,
      tokens[foreground],
      tokens[background],
      TEXT,
    ]),
  )('%s meets 4.5:1', (_label, foreground, background, min) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(min)
  })

  it.each<Pair>(
    nonTextPairs.map(([label, foreground, background]) => [
      label,
      tokens[foreground],
      tokens[background],
      NON_TEXT,
    ]),
  )('%s meets 3:1', (_label, foreground, background, min) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(min)
  })
})
