// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const bootstrap = readFileSync('index.html', 'utf8').match(
  /<script>([\s\S]*?)<\/script>/,
)![1]

const themeColor = () =>
  document.querySelector('meta[name="theme-color"]')?.getAttribute('content')

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  document.documentElement.removeAttribute('data-background')
  document.documentElement.className = ''
  document.head.innerHTML = '<meta name="theme-color" content="#FFFFFF" />'
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  )
})

describe('background preference', () => {
  it('defaults to gradient and applies the attribute', async () => {
    const { useBackgroundStore } = await import('@/lib/stores/background.store')
    expect(useBackgroundStore.getState().style).toBe('gradient')
    expect(document.documentElement.getAttribute('data-background')).toBe(
      'gradient',
    )
  })

  it('seeds from the legacy background key', async () => {
    localStorage.setItem('background', 'gray')
    const { useBackgroundStore } = await import('@/lib/stores/background.store')
    expect(useBackgroundStore.getState().style).toBe('gray')
  })

  it('applies the attribute when the style changes', async () => {
    const { useBackgroundStore } = await import('@/lib/stores/background.store')
    useBackgroundStore.getState().setBackground('neutral')
    expect(document.documentElement.getAttribute('data-background')).toBe(
      'neutral',
    )
    expect(themeColor()).toBe('#ffffff')
  })

  it('ignores an invalid persisted style', async () => {
    localStorage.setItem(
      'background-store',
      JSON.stringify({ state: { style: 'rainbow' }, version: 0 }),
    )
    const { useBackgroundStore } = await import('@/lib/stores/background.store')
    expect(useBackgroundStore.getState().style).toBe('gradient')
    expect(document.documentElement.getAttribute('data-background')).toBe(
      'gradient',
    )
  })
})

describe('pre-paint background bootstrap', () => {
  it('applies gray and its chrome color before render', () => {
    localStorage.setItem('background', 'gray')
    window.eval(bootstrap)
    expect(document.documentElement.getAttribute('data-background')).toBe(
      'gray',
    )
    expect(themeColor()).toBe('#f5f5f7')
  })

  it('falls back to gradient for an invalid style', () => {
    localStorage.setItem('background', 'rainbow')
    window.eval(bootstrap)
    expect(document.documentElement.getAttribute('data-background')).toBe(
      'gradient',
    )
    expect(themeColor()).toBe('#ffffff')
  })

  it('lets dark mode override the chrome color', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    localStorage.setItem('background', 'gray')
    window.eval(bootstrap)
    expect(document.documentElement.getAttribute('data-background')).toBe(
      'gray',
    )
    expect(themeColor()).toBe('#000000')
  })
})
