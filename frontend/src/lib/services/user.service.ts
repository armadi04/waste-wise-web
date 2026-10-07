import type { PaginatedData } from '@/types/api'
import type { UserSearchParams } from '@/lib/schemas/users'
import type { UserProfile } from '@/types/auth'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api'

// NOTE: user creation is invite-only — see invitation.service.ts. There is no
// admin "create user" endpoint; accounts are created when an invite is accepted.

export interface CreateUserData {
  email: string
  fullname: string
  password?: string
  phone?: string | null
  avatar?: string | null
}

export interface UpdateUserData extends Partial<CreateUserData> {
  id: number
}

export const getUsers = (
  params?: UserSearchParams & { paginated?: boolean },
) => {
  return apiGet<PaginatedData<UserProfile> | Array<UserProfile>>('/users', {
    params,
  })
}

export const getUser = (id: number) => {
  return apiGet<UserProfile>(`/users/${id}`)
}

export const updateUser = (id: number, data: Partial<CreateUserData>) => {
  return apiPatch<UserProfile>(`/users/${id}`, data)
}

export const deleteUser = (id: number) => {
  return apiDelete<void>(`/users/${id}`)
}

export const bulkDeleteUsers = (ids: Array<number>) => {
  return apiPost<{ deleted: number }>('/users/bulk-delete', { ids })
}

export const resetUserPassword = (id: number, password: string) => {
  return apiPatch<UserProfile>(`/users/${id}`, { password })
}

export const syncUserRoles = (id: number, roles: Array<number>) => {
  return apiPost<UserProfile>(`/users/${id}/roles/sync`, { roles })
}

export const syncUserPermissions = (id: number, permissions: Array<number>) => {
  return apiPost<UserProfile>(`/users/${id}/permissions/sync`, {
    permissions,
  })
}
