import type { components } from './api.generated'

export type { components }

export type User = components['schemas']['User']
export type Role = components['schemas']['Role']
export type Permission = components['schemas']['Permission']
export type Media = components['schemas']['Media']

export type Notification = components['schemas']['Notification']
export type NotificationType = components['schemas']['Notification']['type']

export type PaginationMeta = components['schemas']['PaginationMetaDto']

export interface Invitation {
  id: number
  token: string
  email: string
  roleIds: Array<number> | null
  invitedBy: number | null
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
}

export interface PaginatedData<T> {
  data: Array<T>
  meta: PaginationMeta
}

export interface ApiResponse<T> {
  data: T
  message?: string
  status?: number
}
