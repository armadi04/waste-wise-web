// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios, { AxiosError } from 'axios'
import { addToast } from '@heroui/react'
import type { InternalAxiosRequestConfig } from 'axios'
import api from '@/lib/api'
import { getCurrentUser } from '@/lib/services/auth.service'
import { isAuthenticated } from '@/lib/utils/cookies'

vi.mock('@heroui/react', () => ({ addToast: vi.fn() }))

const defaultAdapter = api.defaults.adapter
const session = {
  userId: 1,
  email: 'admin@example.test',
  roles: ['admin'],
  permissions: ['users.read'],
  emailVerified: true,
}

function httpError(config: InternalAxiosRequestConfig, status: number) {
  return new AxiosError(
    `Request failed with status code ${status}`,
    undefined,
    config,
    undefined,
    {
      data: { message: status === 403 ? 'Invalid CSRF token' : 'Unauthorized' },
      status,
      statusText: String(status),
      headers: {},
      config,
    },
  )
}

describe('session refresh failures', () => {
  beforeEach(() => {
    document.cookie = 'authenticated=1; Path=/'
    document.cookie = 'csrfToken=valid-token; Path=/'
    api.defaults.adapter = vi.fn((config) =>
      Promise.reject(httpError(config, 401)),
    )
  })

  afterEach(() => {
    api.defaults.adapter = defaultAdapter
    document.cookie = 'authenticated=; Max-Age=0; Path=/'
    document.cookie = 'csrfToken=; Max-Age=0; Path=/'
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it.each([401, 403])(
    'resolves to signed-out when refresh returns %s',
    async (status) => {
      const refresh = vi
        .spyOn(axios, 'post')
        .mockImplementation((_url, _data, config) =>
          Promise.reject(
            httpError(config as InternalAxiosRequestConfig, status),
          ),
        )

      await expect(getCurrentUser()).resolves.toBeNull()
      expect(isAuthenticated()).toBe(false)
      expect(refresh).toHaveBeenCalledTimes(1)
      expect(refresh).toHaveBeenCalledWith(
        api.getUri({ url: '/auth/refresh' }),
        {},
        { withCredentials: true, headers: { 'X-CSRF-Token': 'valid-token' } },
      )
      expect(addToast).not.toHaveBeenCalled()
    },
  )

  it('settles concurrent session reads with one rejected refresh', async () => {
    let rejectRefresh!: (error: unknown) => void
    const refresh = vi.spyOn(axios, 'post').mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRefresh = reject
        }),
    )
    const reads = Promise.all([getCurrentUser(), getCurrentUser()])
    await vi.waitFor(() =>
      expect(api.defaults.adapter).toHaveBeenCalledTimes(2),
    )
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    rejectRefresh(httpError({ headers: {} } as InternalAxiosRequestConfig, 403))

    await expect(reads).resolves.toEqual([null, null])
    expect(isAuthenticated()).toBe(false)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('retries a session read successfully after refresh', async () => {
    api.defaults.adapter = vi.fn((config) => {
      if (
        !(config as InternalAxiosRequestConfig & { _retry?: boolean })._retry
      ) {
        return Promise.reject(httpError(config, 401))
      }
      return Promise.resolve({
        data: session,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      })
    })
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} })

    await expect(getCurrentUser()).resolves.toMatchObject({
      sub: 1,
      email: session.email,
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(api.defaults.adapter).toHaveBeenCalledTimes(2)
    expect(isAuthenticated()).toBe(true)
  })

  it('does not refresh again when the retried session is still unauthorized', async () => {
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ data: {} })

    await expect(getCurrentUser()).resolves.toBeNull()
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(api.defaults.adapter).toHaveBeenCalledTimes(2)
    expect(isAuthenticated()).toBe(false)
  })

  it('does not start another refresh for queued unauthorized retries', async () => {
    let resolveRefresh!: (value: unknown) => void
    const refresh = vi.spyOn(axios, 'post').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve
        }),
    )
    const reads = Promise.all([getCurrentUser(), getCurrentUser()])
    await vi.waitFor(() =>
      expect(api.defaults.adapter).toHaveBeenCalledTimes(2),
    )
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    resolveRefresh({ data: {} })

    await expect(reads).resolves.toEqual([null, null])
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(api.defaults.adapter).toHaveBeenCalledTimes(4)
  })

  it.each(['network', 'server'])(
    'preserves retryable %s refresh errors and the auth flag',
    async (failure) => {
      const error =
        failure === 'network'
          ? new AxiosError('Network Error', 'ERR_NETWORK')
          : httpError({ headers: {} } as InternalAxiosRequestConfig, 500)
      vi.spyOn(axios, 'post').mockRejectedValue(error)

      await expect(getCurrentUser()).rejects.toBe(error)
      expect(isAuthenticated()).toBe(true)
    },
  )

  it('keeps a direct session 403 as an authorization error', async () => {
    api.defaults.adapter = vi.fn((config) =>
      Promise.reject(httpError(config, 403)),
    )
    const refresh = vi.spyOn(axios, 'post')

    await expect(getCurrentUser()).rejects.toMatchObject({
      response: { status: 403 },
    })
    expect(refresh).not.toHaveBeenCalled()
    expect(isAuthenticated()).toBe(true)
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Access Denied' }),
    )
  })
})
