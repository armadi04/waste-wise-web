import type { ScopeGroup } from '@/components/features/changelog/components/release-card/types'
import type { ChangelogEntry } from '@/lib/utils/changelog'

export function groupByScope(
  entries: Array<ChangelogEntry>,
): Array<ScopeGroup> {
  const groups: Array<ScopeGroup> = []
  for (const entry of entries) {
    const last = groups[groups.length - 1]
    if (last && last.scope === entry.scope) last.entries.push(entry)
    else groups.push({ scope: entry.scope, entries: [entry] })
  }
  return groups
}
