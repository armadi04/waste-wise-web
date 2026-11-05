// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as HeroUI from '@heroui/react'
import type { ReactNode } from 'react'
import { LoginPage } from '@/components/features/auth/pages/login'

const mocks = vi.hoisted(() => ({
  submit: vi.fn((event: { preventDefault: () => void }) =>
    event.preventDefault(),
  ),
  verify: vi.fn(),
  pending: false,
}))
vi.mock('@tanstack/react-router', () => ({
  getRouteApi: () => ({ useSearch: () => ({}) }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}))
vi.mock('@heroui/react', async (importOriginal) => ({
  ...(await importOriginal<typeof HeroUI>()),
  Input: ({ label }: { label: string }) => <input aria-label={label} />,
  Divider: () => <hr />,
  Button: ({
    children,
    type,
    onPress,
  }: {
    children: ReactNode
    type?: 'submit' | 'button' | 'reset'
    onPress?: () => void
  }) => (
    <button type={type ?? 'button'} onClick={onPress}>
      {children}
    </button>
  ),
}))
vi.mock('@/components/layout/auth-page-shell/auth-page-shell', () => ({
  AuthPageShell: ({
    children,
    footerStart,
  }: {
    children: ReactNode
    footerStart?: ReactNode
  }) => (
    <div>
      {children}
      {footerStart}
    </div>
  ),
}))
vi.mock('@/components/ui/google-login-button/google-login-button', () => ({
  GOOGLE_LOGIN_ENABLED: false,
  GoogleLoginButton: () => null,
}))
vi.mock('@/components/ui/turnstile-widget/turnstile-widget', () => ({
  TurnstileWidget: () => null,
}))
vi.mock('@/hooks/auth/use-auth', () => ({ useAuthGuard: vi.fn() }))
vi.mock('@/hooks/auth/use-login', () => ({
  useLogin: () => ({
    register: () => ({}),
    onSubmit: mocks.submit,
    isLoading: false,
    isPasswordVisible: false,
    formState: { errors: {} },
    isTurnstileReady: true,
    isTwoFactorPending: mocks.pending,
    twoFactorCode: '123456',
    onVerifyTwoFactor: mocks.verify,
  }),
}))
beforeEach(() => {
  mocks.pending = false
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('login page forms', () => {
  it('shows the WasteWise brand in the heading', () => {
    render(<LoginPage />)
    expect(
      screen.getByRole('heading', { name: /Welcome back to WasteWise/ }),
    ).toBeTruthy()
  })

  it('connects the email form to the login submission handler', () => {
    render(<LoginPage />)
    const form = screen.getByLabelText('Email').closest('form')!
    fireEvent.submit(form)
    expect(mocks.submit).toHaveBeenCalledOnce()
    expect(mocks.verify).not.toHaveBeenCalled()
  })

  it('submits the pending two-factor form without submitting the email form', () => {
    mocks.pending = true
    render(<LoginPage />)
    fireEvent.submit(
      screen.getByLabelText('Authentication code').closest('form')!,
    )
    expect(mocks.verify).toHaveBeenCalledOnce()
    expect(mocks.submit).not.toHaveBeenCalled()
  })
})
