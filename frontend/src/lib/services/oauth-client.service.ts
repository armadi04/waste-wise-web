import type { PaginatedData } from '@/types/api'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api'

/**
 * An OAuth2 client (client_credentials grant). The client secret is never
 * returned after creation — only the bcrypt hash is stored server-side — so it
 * is absent from this type and surfaced once via {@link IssuedOAuthClient}.
 */
export interface OAuthClient {
  id: number
  clientId: string
  name: string
  scopes: Array<string>
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Create response: the client plus its plaintext secret, shown exactly once. */
export interface IssuedOAuthClient {
  client: OAuthClient
  clientSecret: string
}

export interface CreateOAuthClientData {
  name: string
  scopes: Array<string>
}

export interface UpdateOAuthClientData {
  name?: string
  scopes?: Array<string>
  isActive?: boolean
}

export const getOAuthClients = (params?: {
  page?: number
  limit?: number
  search?: string
  sort?: string
  direction?: string
  paginated?: boolean
}) => {
  return apiGet<PaginatedData<OAuthClient> | Array<OAuthClient>>(
    '/api/oauth/clients',
    { params },
  )
}

export const getOAuthClient = (id: number) => {
  return apiGet<OAuthClient>(`/api/oauth/clients/${id}`)
}

export const createOAuthClient = (data: CreateOAuthClientData) => {
  return apiPost<IssuedOAuthClient>('/api/oauth/clients', data)
}

export const updateOAuthClient = (id: number, data: UpdateOAuthClientData) => {
  return apiPatch<OAuthClient>(`/api/oauth/clients/${id}`, data)
}

export const deleteOAuthClient = (id: number) => {
  return apiDelete<void>(`/api/oauth/clients/${id}`)
}

export const bulkDeleteOAuthClients = (ids: Array<number>) => {
  return apiPost<{ deleted: number }>('/api/oauth/clients/bulk-delete', { ids })
}
