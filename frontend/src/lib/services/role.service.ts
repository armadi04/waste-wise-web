import type { PaginatedData } from '@/types/api'
import type { Role } from '@/types/auth'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api'

export interface CreateRoleData {
  name: string
  description?: string
  permissions?: Array<number>
}

export interface UpdateRoleData extends Partial<CreateRoleData> {
  id: number
}

export const getRoles = (params?: {
  page?: number
  limit?: number
  search?: string
  sort?: string
  direction?: string
  paginated?: boolean
}) => {
  return apiGet<PaginatedData<Role> | Array<Role>>('/api/roles', {
    params,
  })
}

export const getRole = (id: number) => {
  return apiGet<Role>(`/api/roles/${id}`)
}

export const createRole = (data: CreateRoleData) => {
  return apiPost<Role>('/api/roles', data)
}

export const updateRole = (id: number, data: Partial<CreateRoleData>) => {
  return apiPatch<Role>(`/api/roles/${id}`, data)
}

export const deleteRole = (id: number) => {
  return apiDelete<void>(`/api/roles/${id}`)
}

export const bulkDeleteRoles = (ids: Array<number>) => {
  return apiPost<{ deleted: number }>('/api/roles/bulk-delete', { ids })
}

export const syncRolePermissions = (id: number, permissions: Array<number>) => {
  return apiPost<Role>(`/api/roles/${id}/permissions/sync`, {
    permissions,
  })
}
