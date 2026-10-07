import { Chip, Spinner } from '@heroui/react'
import { History } from 'lucide-react'
import { ReleaseCard } from '@/components/features/changelog/components/release-card'
import { PageHeader } from '@/components/layout/page-header'
import { useChangelog } from '@/hooks/changelog'

export function ChangelogPage() {
  const { releases, version, isLoading } = useChangelog()

  return (
    <div>
      <PageHeader
        title="Changelog"
        breadcrumbs={[
          { label: 'Preferences' },
          { label: 'Changelog', isCurrent: true },
        ]}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3 rounded-large border border-default-200 bg-content1 px-6 py-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-base font-semibold text-default-700">
              What's new in Nestplate
            </p>
            <p className="max-w-2xl text-sm leading-relaxed text-default-500">
              Every update is recorded here — new features, fixes, and changes
              worth knowing about.
            </p>
          </div>
          {version && (
            <Chip size="sm" variant="flat" color="primary">
              Version {version}
            </Chip>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="sm" />
          </div>
        ) : releases.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-large border border-dashed border-default-200 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <History size={22} />
            </span>
            <p className="text-sm font-semibold text-default-700">
              No releases yet
            </p>
            <p className="max-w-sm text-xs text-default-400">
              The history appears automatically once the first release is
              published.
            </p>
          </div>
        ) : (
          releases.map((release, index) => (
            <ReleaseCard
              key={release.version}
              release={release}
              isLatest={index === 0}
            />
          ))
        )}
      </div>
    </div>
  )
}
