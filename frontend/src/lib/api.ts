import axios from 'axios'
import { buildApiUrl } from './config/api-url'
import { clearAuthFlag } from './utils/cookies'
import type {
  AxiosError,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { addToast } from '@/components/shared/controls/toast'
import { getCsrfToken } from '@/lib/utils/csrf'

let isRefreshing = false
let failedQueue: Array<{
  resolve: () => void
  reject: (error: any) => void
}> = []

const processQueue = (error: any) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve()
    }
  })
  failedQueue = []
}

const api: AxiosInstance = axios.create({
  baseURL: buildApiUrl(import.meta.env.VITE_API_URL),
  timeout: 30000,
  // Auth is a cookie (httpOnly accessToken) sent automatically; no
  // Authorization header is set client-side. withCredentials is required so the
  // cookie rides along on every request.
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  buildApiUrl(import.meta.env.VITE_API_URL, config.url ?? '')
  if (['post', 'put', 'patch', 'delete'].includes(config.method ?? 'get')) {
    const csrf = getCsrfToken()
    if (csrf) config.headers.set('X-CSRF-Token', csrf)
  }
  return config
})

api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    if (!originalRequest) return Promise.reject(error)

    // Check if it's an auth endpoint (login or refresh)
    // We shouldn't retry these if they fail
    const isAuthRequest =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/google') ||
      originalRequest.url?.includes('/auth/2fa/verify')

    // Handle 401 Unauthorized - access token expired. The refresh rotates the
    // httpOnly cookie server-side; the retried request just re-sends it.
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRequest
    ) {
      // Queued requests also get only one refresh attempt.
      originalRequest._retry = true
      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => api(originalRequest))
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      isRefreshing = true

      try {
        // Raw axios (not the `api` instance) to avoid an interceptor loop, but
        // target the configured API base URL so the refresh cookie — which is
        // scoped to the API origin — is actually sent in a cross-origin setup.
        // The backend resets the httpOnly accessToken cookie; nothing stored here.
        await axios.post(
          api.getUri({ url: '/auth/refresh' }),
          {},
          {
            withCredentials: true,
            headers: { 'X-CSRF-Token': getCsrfToken() },
          },
        )

        processQueue(null)
        return api(originalRequest)
      } catch (refreshError) {
        const sessionRejected =
          axios.isAxiosError(refreshError) &&
          (refreshError.response?.status === 401 ||
            refreshError.response?.status === 403)
        // Refresh may fail CSRF validation with 403 before checking the session.
        // Preserve the original 401 so session guards resolve to signed-out.
        // Network/server failures remain retryable without dropping the session.
        const requestError = sessionRejected ? error : refreshError
        processQueue(requestError)
        if (!sessionRejected) return Promise.reject(requestError)
        // The full-page redirect destroys this QueryClient. Let the pending
        // session read settle so its route guard can redirect without CancelledError.
        clearAuthFlag()
        if (originalRequest.url !== '/auth/me') window.location.href = '/login'
        return Promise.reject(requestError)
      } finally {
        isRefreshing = false
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      addToast({
        title: 'Access Denied',
        description: 'You do not have permission to perform this action.',
        color: 'danger',
      })
    }

    // Handle 500 Internal Server Error
    if (error.response?.status === 500) {
      addToast({
        title: 'Server Error',
        description: 'Something went wrong. Please try again later.',
        color: 'danger',
      })
    }

    return Promise.reject(error)
  },
)

export default api

// Export typed request methods for convenience
export const apiGet = <T>(url: string, config?: object) =>
  api.get<T>(url, config).then((res) => res.data)

export const apiPost = <T>(url: string, data?: object, config?: object) =>
  api.post<T>(url, data, config).then((res) => res.data)

export const apiPut = <T>(url: string, data?: object, config?: object) =>
  api.put<T>(url, data, config).then((res) => res.data)

export const apiPatch = <T>(url: string, data?: object, config?: object) =>
  api.patch<T>(url, data, config).then((res) => res.data)

export const apiDelete = <T>(url: string, config?: object) =>
  api.delete<T>(url, config).then((res) => res.data)

/** Resolve a backend path against the configured origin for browser navigation. */
export const apiUrl = (path: string) =>
  buildApiUrl(import.meta.env.VITE_API_URL, path)
