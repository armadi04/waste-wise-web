import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApiUrl, normalizeApiOrigin } from '@/lib/config/api-url'

vi.mock('@/components/shared/controls/toast', () => ({ addToast: vi.fn() }))

describe('versioned API URL composition', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it.each(['', 'https://api.example.test', 'https://api.example.test/'])(
    'resolves resource and refresh URLs with origin %s',
    async (origin) => {
      vi.stubEnv('VITE_API_URL', origin)
      const { default: api, apiUrl } = await import('@/lib/api')
      for (const path of ['/users', '/auth/refresh']) {
        const expected = `${normalizeApiOrigin(origin)}/api/v1${path}`
        expect(apiUrl(path)).toBe(expected)
        expect(api.getUri({ url: path })).toBe(expected)
        expect(apiUrl(path)).not.toContain('/api/v1/api/v1')
      }
    },
  )

  it.each([
    'https://api.example.test/api',
    'https://api.example.test/api/v1',
    'https://api.example.test/other',
    'https://api.example.test/a/..',
    'https://api.example.test/?key=value',
    'https://api.example.test/#section',
    'https://api.example.test?',
    'https://api.example.test#',
    'https://user:password@api.example.test',
    'ftp://api.example.test',
    '//api.example.test',
    'not-a-url',
    ' https://api.example.test',
    'https://api.example.test//',
    'https://api.example.test\\other',
  ])(
    'rejects invalid origin %s without echoing the supplied value',
    (origin) => {
      expect(() => normalizeApiOrigin(origin)).toThrow(
        'VITE_API_URL must be an HTTP(S) origin',
      )
    },
  )

  it.each([
    '/api/v1/users',
    '/api/users',
    '//external.example.test/users',
    'users',
  ])(
    'rejects resource path %s that violates the shared builder contract',
    (path) => {
      expect(() => buildApiUrl('', path)).toThrow('REST resource paths')
    },
  )

  it('normalizes the root slash and retains an explicit port', () => {
    expect(normalizeApiOrigin('http://localhost:3000/')).toBe(
      'http://localhost:3000',
    )
    expect(buildApiUrl('http://localhost:3000/', '/health')).toBe(
      'http://localhost:3000/api/v1/health',
    )
  })

  it('fails client initialization for a configured API path', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test/api/v1')
    await expect(import('@/lib/api')).rejects.toThrow(
      'VITE_API_URL must be an HTTP(S) origin',
    )
  })
})
