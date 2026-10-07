import api from '../api'
import type { LoginResponse } from '@/types/auth'

/** Two-factor state for the signed-in user. Off until enrollment is confirmed. */
export interface TwoFactorStatus {
  enabled: boolean
  recoveryCodesRemaining: number
}

/** What the user needs to add the account to an authenticator app. */
export interface TwoFactorEnrollment {
  /** Base32 secret, for apps that can't scan a QR. */
  secret: string
  otpauthUrl: string
  /** PNG data URL rendered straight into an `<img>`. */
  qrDataUrl: string
}

export const getTwoFactorStatus = async (): Promise<TwoFactorStatus> => {
  const { data } = await api.get<TwoFactorStatus>('/api/auth/2fa')
  return data
}

export const startTwoFactorSetup = async (): Promise<TwoFactorEnrollment> => {
  const { data } = await api.post<TwoFactorEnrollment>('/api/auth/2fa/setup')
  return data
}

export const enableTwoFactor = async (
  code: string,
): Promise<Array<string>> => {
  const { data } = await api.post<{ recoveryCodes: Array<string> }>(
    '/api/auth/2fa/enable',
    { code },
  )
  return data.recoveryCodes
}

export const disableTwoFactor = async (code: string): Promise<void> => {
  await api.post('/api/auth/2fa/disable', { code })
}

export const regenerateRecoveryCodes = async (
  code: string,
): Promise<Array<string>> => {
  const { data } = await api.post<{ recoveryCodes: Array<string> }>(
    '/api/auth/2fa/recovery-codes',
    { code },
  )
  return data.recoveryCodes
}

/** Finish a login that stopped at the second factor. Cookies are set server-side. */
export const verifyTwoFactorLogin = async (
  challengeToken: string,
  code: string,
): Promise<LoginResponse> => {
  const { data } = await api.post<LoginResponse>('/api/auth/2fa/verify', {
    challengeToken,
    code,
  })
  return data
}
