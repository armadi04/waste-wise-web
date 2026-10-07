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
  return apiGet<PaginatedData<Permission> | Array<Permission>>(
    '/api/permissions',
    {
      params,
    },
  )
}

export const getPermission = (id: number) => {
  return apiGet<Permission>(`/api/permissions/${id}`)
}

export const createPermission = (data: CreatePermissionData) => {
  return apiPost<Permission>('/api/permissions', data)
}

export const updatePermission = (
  id: number,
  data: Partial<CreatePermissionData>,
) => {
  return apiPatch<Permission>(`/api/permissions/${id}`, data)
}

export const deletePermission = (id: number) => {
  return apiDelete<void>(`/api/permissions/${id}`)
}

export const bulkDeletePermissions = (ids: Array<number>) => {
  return apiPost<{ deleted: number }>('/api/permissions/bulk-delete', { ids })
}
