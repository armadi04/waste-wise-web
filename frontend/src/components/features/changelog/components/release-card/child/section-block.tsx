import type { ChangelogSection } from '@/lib/utils/changelog'
import { groupByScope } from '@/components/features/changelog/components/release-card/lib/release-card-helpers'
import {
  SECTION_STYLE,
  scopeLabel,
  tidyDescription,
} from '@/lib/constants/changelog-labels'
import { useTimeZone } from '@/lib/stores/time-zone'

export function SectionBlock({ section }: { section: ChangelogSection }) {
  useTimeZone((s) => s.timeZone)
  const style = SECTION_STYLE[section.kind]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${style.dot}`} />
          <h3 className={`text-sm font-semibold ${style.text}`}>
            {section.title}
          </h3>
        </span>
        <p className="pl-4 text-xs text-default-400">{style.hint}</p>
      </div>

      <div className="flex flex-col gap-4 pl-4">
        {groupByScope(section.entries).map((group, groupIndex) => (
          <div
            key={`${group.scope ?? 'general'}-${groupIndex}`}
            className="flex flex-col gap-1.5"
          >
            {group.scope && (
              <p className="text-xs font-medium text-default-500">
                {scopeLabel(group.scope)}
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {group.entries.map((entry, index) => (
                <li
                  key={`${entry.commit ?? 'x'}-${index}`}
                  className="flex gap-2.5 text-sm leading-relaxed text-default-600"
                >
                  <span
                    aria-hidden
                    className="mt-2 size-1 shrink-0 rounded-full bg-default-300"
                  />
                  <span className="min-w-0">
                    {tidyDescription(entry.description)}
                    {entry.commitUrl && entry.commit && (
                      <a
                        href={entry.commitUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="View the code change"
                        className="ml-2 font-mono text-[11px] text-default-500 transition-colors hover:text-[var(--app-link)]"
                      >
                        {entry.commit.slice(0, 7)}
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
