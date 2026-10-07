import type { PaginatedData } from '@/types/api'
import type { Permission } from '@/types/auth'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api'

export interface CreatePermissionData {
  name: string
  description?: string
}

export interface UpdatePermissionData extends Partial<CreatePermissionData> {
  id: number
}

export const getPermissions = (params?: {
  page?: number
  limit?: number
  search?: string
  sort?: string
  direction?: string
  paginated?: boolean
}) => {
  return apiGet<PaginatedData<Permission> | Array<Permission>>('/permissions', {
    params,
  })
}

export const getPermission = (id: number) => {
  return apiGet<Permission>(`/permissions/${id}`)
}

export const createPermission = (data: CreatePermissionData) => {
  return apiPost<Permission>('/permissions', data)
}

export const updatePermission = (
  id: number,
  data: Partial<CreatePermissionData>,
) => {
  return apiPatch<Permission>(`/permissions/${id}`, data)
}

export const deletePermission = (id: number) => {
  return apiDelete<void>(`/permissions/${id}`)
}

export const bulkDeletePermissions = (ids: Array<number>) => {
  return apiPost<{ deleted: number }>('/permissions/bulk-delete', { ids })
}
