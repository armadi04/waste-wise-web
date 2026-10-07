import type { components } from '@/types/api.generated'

export type RegisterMethod = components['schemas']['User']['registerMethod']
export const REGISTER_METHODS = [
  'EMAIL_OTP',
  'GOOGLE',
  'INVITATION',
  'SSO',
  'SEEDER',
  'UNKNOWN',
] as const satisfies ReadonlyArray<RegisterMethod>
export const REGISTER_METHOD_LABEL: Record<RegisterMethod, string> = {
  EMAIL_OTP: 'Email & OTP',
  GOOGLE: 'Google',
  INVITATION: 'Undangan',
  SSO: 'SSO',
  SEEDER: 'Seeder',
  UNKNOWN: 'Tidak diketahui',
}
export const REGISTER_METHOD_COLOR: Record<
  RegisterMethod,
  'primary' | 'danger' | 'secondary' | 'success' | 'warning' | 'default'
> = {
  EMAIL_OTP: 'primary',
  GOOGLE: 'danger',
  INVITATION: 'secondary',
  SSO: 'success',
  SEEDER: 'warning',
  UNKNOWN: 'default',
}
