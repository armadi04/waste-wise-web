import type { ChangelogEntry } from '@/lib/utils/changelog'

export interface ScopeGroup {
  scope: string | null
  entries: Array<ChangelogEntry>
}
