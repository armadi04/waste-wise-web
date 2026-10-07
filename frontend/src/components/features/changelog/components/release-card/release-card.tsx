import { Chip } from '@heroui/react'
import { formatDistanceToNow } from 'date-fns'
import { ExternalLink } from 'lucide-react'
import type { ChangelogRelease } from '@/lib/utils/changelog'
import { SectionBlock } from '@/components/features/changelog/components/release-card/child/section-block'
import { useTimeZone } from '@/lib/stores/time-zone'
import { repoUrlFrom } from '@/lib/utils/changelog'
import { formatBusinessDate as format } from '@/lib/utils/format'

/**
 * One release, rendered from parsed data rather than markdown.
 *
 * Aimed at users, not developers: each section carries a one-line explanation
 * of what the group means, module names come from the sidebar's vocabulary, and
 * the date is phrased relatively with the exact day on hover.
 */
export function ReleaseCard({
  release,
  isLatest,
}: {
  release: ChangelogRelease
  isLatest: boolean
}) {
  useTimeZone((s) => s.timeZone)
  const repoUrl = repoUrlFrom(release)

  return (
    <section className="rounded-large border border-default-200 bg-content1">
      <header className="flex flex-wrap items-center gap-2.5 border-b border-default-100 px-6 py-4">
        <h2 className="text-base font-semibold text-default-700">
          Version {release.version}
        </h2>
        {isLatest && (
          <Chip size="sm" color="primary" variant="flat">
            Latest
          </Chip>
        )}
        {release.date && (
          <span
            title={format(release.date, 'd MMM yyyy')}
            className="text-xs text-default-400"
          >
            {formatDistanceToNow(new Date(release.date), { addSuffix: true })}
          </span>
        )}
        {repoUrl && release.compareUrl && (
          <a
            href={release.compareUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto flex items-center gap-1 text-xs text-default-400 transition-colors hover:text-primary"
          >
            Compare <ExternalLink size={12} />
          </a>
        )}
      </header>

      <div className="flex flex-col divide-y divide-default-100">
        {release.sections.map((section) => (
          <div key={section.title} className="px-6 py-5">
            <SectionBlock section={section} />
          </div>
        ))}
      </div>
    </section>
  )
}
