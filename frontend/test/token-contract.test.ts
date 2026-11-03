import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ThemeName } from '@/lib/theme/palette'
import { appTokens } from '@/lib/theme/palette'

const css = readFileSync('src/styles/tokens.css', 'utf8')

const parseTheme = (theme: ThemeName): Record<string, string> => {
  const match = css.match(
    new RegExp(`:root\\.${theme}\\s*\\{([\\s\\S]*?)\\n\\}`),
  )
  expect(match, `:root.${theme} block`).not.toBeNull()

  const tokens: Record<string, string> = {}
  for (const line of match![1].split('\n')) {
    const declaration = line.match(/--app-([a-z0-9-]+):\s*([^;]+);/)
    if (declaration) tokens[declaration[1]] = declaration[2].trim()
  }
  return tokens
}

describe('generated token contract', () => {
  it.each<ThemeName>(['light', 'dark'])(
    'tokens.css matches the palette source (%s)',
    (theme) => {
      expect(parseTheme(theme)).toEqual(appTokens[theme])
    },
  )

  it('declares the same token names in both themes', () => {
    expect(Object.keys(appTokens.light).sort()).toEqual(
      Object.keys(appTokens.dark).sort(),
    )
  })
})
