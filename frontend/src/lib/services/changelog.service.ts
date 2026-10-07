import type { ReleaseNotes } from '@/types/changelog'
import { apiGet } from '@/lib/api'

export const getReleaseNotes = () => apiGet<Array<ReleaseNotes>>('/changelog')
