// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import axios, { AxiosError } from 'axios'
import api from '@/lib/api'
import { useAuthStore } from '@/lib/stores/auth.store'

vi.mock('@heroui/react', () => ({ addToast: vi.fn() }))
const adapter = api.defaults.adapter
afterEach(() => {
  api.defaults.adapter = adapter
  document.cookie = 'authenticated=; Max-Age=0; Path=/'
  vi.restoreAllMocks()
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
    error: null,
    isLoading: false,
  })
})
describe('two-factor login', () => {
  it.each(['password', 'google'])(
    'recognizes the %s challenge without reading identity',
    async (kind) => {
      api.defaults.adapter = vi.fn((config) =>
        Promise.resolve({
          data: { twoFactorRequired: true, challengeToken: 'challenge' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }),
      )
      const sync = vi.spyOn(useAuthStore.getState(), 'syncAuth')
      const result =
        kind === 'password'
          ? await useAuthStore
              .getState()
              .login({ email: 'admin@example.test', password: 'secret' })
          : await useAuthStore.getState().loginWithGoogle('google-token')
      expect(result).toEqual({
        success: false,
        twoFactorRequired: true,
        challengeToken: 'challenge',
      })
      expect(sync).not.toHaveBeenCalled()
    },
  )
  it('allows a correct code after an incorrect code without refreshing or redirecting', async () => {
    const refresh = vi.spyOn(axios, 'post')
    const location = window.location.href
    api.defaults.adapter = vi.fn((config) => {
      if (
        config.url === '/auth/2fa/verify' &&
        JSON.parse(config.data).code === '000000'
      )
        return Promise.reject(
          new AxiosError('Invalid code', undefined, config, undefined, {
            data: { message: 'Invalid code' },
            status: 401,
            statusText: 'Unauthorized',
            headers: {},
            config,
          }),
        )
      if (config.url === '/auth/2fa/verify')
        document.cookie = 'authenticated=1; Path=/'
      return Promise.resolve({
        data:
          config.url === '/auth/me'
            ? {
                userId: 7,
                email: 'admin@example.test',
                roles: ['admin'],
                permissions: [],
              }
            : {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      })
    })
    expect(
      await useAuthStore.getState().verifyTwoFactor('challenge', '000000'),
    ).toEqual({ success: false, error: 'Invalid code' })
    expect(refresh).not.toHaveBeenCalled()
    expect(window.location.href).toBe(location)
    expect(
      await useAuthStore.getState().verifyTwoFactor('challenge', '123456'),
    ).toEqual({ success: true })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })
})
