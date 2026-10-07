// @vitest-environment jsdom
import { act, forwardRef, useEffect, useImperativeHandle } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Root } from 'react-dom/client'
import type {
  TurnstileInstance,
  TurnstileProps,
} from '@marsidev/react-turnstile'
import { validateTurnstileSiteKey } from '@/lib/config/turnstile'
import { useTurnstile } from '@/hooks/auth'
import { TurnstileWidget } from '@/components/ui/turnstile-widget'

const mocks = vi.hoisted(() => ({ dark: true, loaded: true, reset: vi.fn() }))
let callbacks: TurnstileProps
let state: ReturnType<typeof useTurnstile>

vi.mock('@/hooks/global/use-theme', () => ({
  useTheme: () => ({ isDark: mocks.dark }),
}))
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: forwardRef<TurnstileInstance, TurnstileProps>((props, ref) => {
    callbacks = props
    useImperativeHandle(
      ref,
      () => ({ reset: mocks.reset }) as unknown as TurnstileInstance,
    )
    useEffect(() => {
      if (mocks.loaded) props.onWidgetLoad?.('widget')
    }, [props.onWidgetLoad])
    return <div data-testid="provider-widget" />
  }),
}))

function Probe() {
  state = useTurnstile()
  return <TurnstileWidget {...state} />
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key')
  vi.useFakeTimers()
  mocks.dark = true
  mocks.loaded = true
  mocks.reset.mockReset()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})
async function render() {
  await act(() => root.render(<Probe />))
}

describe('Turnstile widget lifecycle', () => {
  it('does not render the provider widget during SSR', () => {
    expect(renderToString(<Probe />)).toBe('')
  })
  it('uses default width, the application theme, and the admin action', async () => {
    await render()
    expect(callbacks.options).toMatchObject({
      size: 'normal',
      theme: 'dark',
      action: 'admin-login',
    })
    await act(() => callbacks.onSuccess?.('token'))
    expect(state.isReady).toBe(true)
    mocks.dark = false
    await render()
    expect(callbacks.options?.theme).toBe('light')
    expect(state.token).toBeUndefined()
    await act(() => vi.advanceTimersByTime(15_000))
    expect(state.error).toBeUndefined()
  })
  it.each(['onExpire', 'onTimeout', 'onError', 'onUnsupported'] as const)(
    'clears readiness after %s',
    async (callback) => {
      await render()
      await act(() => callbacks.onSuccess?.('token'))
      await act(() => {
        if (callback === 'onError') callbacks.onError?.('challenge-failed')
        else if (callback === 'onExpire') callbacks.onExpire?.('expired-token')
        else callbacks[callback]?.()
      })
      expect(state.isReady).toBe(false)
      expect(state.error).toBeTruthy()
      await act(() => state.reset())
      expect(mocks.reset).toHaveBeenCalled()
      expect(state.error).toBeUndefined()
    },
  )
  it('surfaces a script-loading timeout instead of leaving submit blocked without feedback', async () => {
    mocks.loaded = false
    await render()
    await act(() => vi.advanceTimersByTime(15_000))
    expect(state.scriptFailed).toBe(true)
    expect(state.isReady).toBe(false)
    await act(() => callbacks.onSuccess?.('recovered-token'))
    expect(state.scriptFailed).toBe(false)
    expect(state.isReady).toBe(true)
  })
  it('reports explicit script failure and clears the token', async () => {
    await render()
    await act(() => callbacks.onSuccess?.('token'))
    await act(() => callbacks.scriptOptions?.onError?.())
    expect(state.scriptFailed).toBe(true)
    expect(state.token).toBeUndefined()
  })
})

describe('production site key policy', () => {
  it.each([
    '1x00000000000000000000AA',
    '2x00000000000000000000AB',
    '1x00000000000000000000BB',
    '2x00000000000000000000BB',
    '3x00000000000000000000FF',
  ])('rejects official test key %s in production builds', (key) => {
    expect(() => validateTurnstileSiteKey(key, true)).toThrow('test site keys')
    expect(() => validateTurnstileSiteKey(key, false)).not.toThrow()
  })
  it('allows an unconfigured frontend or a production key', () => {
    expect(() => validateTurnstileSiteKey(undefined, true)).not.toThrow()
    expect(() => validateTurnstileSiteKey('production-key', true)).not.toThrow()
  })
})
