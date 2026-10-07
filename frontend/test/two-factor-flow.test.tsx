// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as HeroUI from '@heroui/react'
import { GoogleLoginButton } from '@/components/ui/google-login-button'
import { useLogin } from '@/hooks/auth'

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  loginGoogle: vi.fn(),
  googleConfig: {
    onSuccess: (_token: { access_token: string }) => Promise.resolve(),
  },
  verify: vi.fn(),
  navigate: vi.fn(),
  reset: vi.fn(),
}))
vi.mock('@heroui/react', async (importOriginal) => ({
  ...(await importOriginal<typeof HeroUI>()),
  addToast: vi.fn(),
  Button: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
}))
vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: (options: typeof mocks.googleConfig) => {
    Object.assign(mocks.googleConfig, options)
    return vi.fn()
  },
}))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('@/hooks/auth/use-auth', () => ({
  useAuth: () => ({
    login: mocks.login,
    loginWithGoogle: mocks.loginGoogle,
    verifyTwoFactor: mocks.verify,
    isLoading: false,
  }),
}))
vi.mock('@/hooks/auth/use-turnstile', () => ({
  useTurnstile: () => ({ isVerified: true, reset: mocks.reset }),
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
describe('pending two-factor form', () => {
  it.each(['password', 'google'])(
    'keeps the %s challenge after a wrong code and navigates only after success',
    async (source) => {
      mocks.loginGoogle.mockResolvedValue({
        success: false,
        twoFactorRequired: true,
        challengeToken: 'challenge',
      })
      mocks.login.mockResolvedValue({
        success: false,
        twoFactorRequired: true,
        challengeToken: 'challenge',
      })
      mocks.verify
        .mockResolvedValueOnce({ success: false, error: 'Invalid code' })
        .mockResolvedValueOnce({ success: true })
      const { result } = renderHook(() => useLogin())
      if (source === 'password') {
        act(() => {
          result.current.setValue('email', 'admin@example.test')
          result.current.setValue('password', 'password123')
        })
        await act(async () => {
          await result.current.onSubmit()
          expect(mocks.reset).toHaveBeenCalled()
        })
      } else {
        render(
          <GoogleLoginButton
            onChallenge={result.current.onTwoFactorChallenge}
          />,
        )
        await act(async () => {
          await mocks.googleConfig.onSuccess({ access_token: 'google-token' })
        })
        expect(mocks.loginGoogle).toHaveBeenCalledWith('google-token')
      }
      expect(result.current.isTwoFactorPending).toBe(true)
      expect(mocks.navigate).not.toHaveBeenCalled()
      act(() => result.current.setTwoFactorCode('000000'))
      await act(async () => {
        await result.current.onVerifyTwoFactor()
      })
      expect(result.current.isTwoFactorPending).toBe(true)
      expect(result.current.twoFactorCode).toBe('')
      expect(mocks.navigate).not.toHaveBeenCalled()
      act(() => result.current.setTwoFactorCode('123456'))
      await act(async () => {
        await result.current.onVerifyTwoFactor()
      })
      expect(mocks.verify).toHaveBeenNthCalledWith(2, 'challenge', '123456')
      expect(result.current.isTwoFactorPending).toBe(false)
      expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' })
    },
  )
  it('clears the challenge when the user cancels', () => {
    const { result } = renderHook(() => useLogin())
    act(() => result.current.onTwoFactorChallenge('challenge'))
    act(() => result.current.cancelTwoFactor())
    expect(result.current.isTwoFactorPending).toBe(false)
    expect(mocks.reset).toHaveBeenCalled()
  })
})
