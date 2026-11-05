// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const bootstrap = readFileSync('index.html', 'utf8').match(
  /<script>([\s\S]*?)<\/script>/,
)![1]

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  document.documentElement.className = ''
  document.head.innerHTML = '<meta name="theme-color" content="#FFFFFF" />'
})
afterEach(() => vi.restoreAllMocks())

function system(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: dark })),
  )
}

function checkRoot(dark: boolean) {
  expect(document.documentElement.className).toBe(dark ? 'dark' : 'light')
  expect(document.documentElement.style.colorScheme).toBe(
    dark ? 'dark' : 'light',
  )
  expect(
    document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
  ).toBe(dark ? '#000000' : '#ffffff')
}

describe('theme preference and pre-paint bootstrap', () => {
  it.each([true, false])(
    'uses the system without an explicit preference (%s)',
    async (dark) => {
      system(dark)
      window.eval(bootstrap)
      checkRoot(dark)
      const { useThemeStore } = await import('@/lib/stores/theme.store')
      expect(useThemeStore.getState().isDark).toBe(dark)
      checkRoot(dark)
    },
  )

  it.each([true, false])(
    'prioritizes the persisted preference over legacy and system (%s)',
    async (dark) => {
      system(!dark)
      localStorage.setItem('theme', dark ? 'light' : 'dark')
      localStorage.setItem(
        'theme-store',
        JSON.stringify({ state: { isDark: dark }, version: 0 }),
      )
      window.eval(bootstrap)
      checkRoot(dark)
      const { useThemeStore } = await import('@/lib/stores/theme.store')
      expect(useThemeStore.getState().isDark).toBe(dark)
      checkRoot(dark)
    },
  )

  it('retains legacy preference and saves subsequent explicit changes', async () => {
    system(false)
    localStorage.setItem('theme', 'dark')
    window.eval(bootstrap)
    checkRoot(true)
    const { useThemeStore } = await import('@/lib/stores/theme.store')
    useThemeStore.getState().setTheme(false)
    checkRoot(false)
    expect(JSON.parse(localStorage.getItem('theme-store')!).state.isDark).toBe(
      false,
    )
    useThemeStore.getState().toggle()
    checkRoot(true)
  })

  it.each(['{broken', '{"state":{"isDark":"false"},"version":0}'])(
    'falls back safely for invalid preferences: %s',
    async (saved) => {
      system(true)
      localStorage.setItem('theme-store', saved)
      window.eval(bootstrap)
      checkRoot(true)
      const { useThemeStore } = await import('@/lib/stores/theme.store')
      expect(useThemeStore.getState().isDark).toBe(true)
      checkRoot(true)
    },
  )

  it('can initialize when browser storage is unavailable', async () => {
    system(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    window.eval(bootstrap)
    checkRoot(false)
    const { getInitialDark } = await import('@/lib/stores/theme.store')
    expect(getInitialDark()).toBe(false)
  })
})
