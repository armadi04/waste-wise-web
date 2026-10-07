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
  return apiGet<PaginatedData<Role> | Array<Role>>('/roles', {
    params,
  })
}

export const getRole = (id: number) => {
  return apiGet<Role>(`/roles/${id}`)
}

export const createRole = (data: CreateRoleData) => {
  return apiPost<Role>('/roles', data)
}

export const updateRole = (id: number, data: Partial<CreateRoleData>) => {
  return apiPatch<Role>(`/roles/${id}`, data)
}

export const deleteRole = (id: number) => {
  return apiDelete<void>(`/roles/${id}`)
}

export const bulkDeleteRoles = (ids: Array<number>) => {
  return apiPost<{ deleted: number }>('/roles/bulk-delete', { ids })
}

export const syncRolePermissions = (id: number, permissions: Array<number>) => {
  return apiPost<Role>(`/roles/${id}/permissions/sync`, {
    permissions,
  })
}
