/**
 * Parser for the release notes `semantic-release` generates.
 *
 * The file is machine-written by the `conventionalcommits` preset, so its shape
 * is narrow and stable — worth parsing into real data rather than rendering as
 * markdown. That gives the page a proper release timeline (scopes as chips,
 * commit links, section colours) with no markdown dependency and nothing going
 * through `dangerouslySetInnerHTML`.
 *
 * If the emitted format ever changes, this file and its tests change with it —
 * see the note in the repo CLAUDE.md.
 */

export type SectionKind = 'feature' | 'fix' | 'breaking' | 'other'

export interface ChangelogEntry {
  /** Conventional-commit scope, e.g. `repository`. */
  scope: string | null
  description: string
  /** Short SHA as printed in the changelog. */
  commit: string | null
  commitUrl: string | null
}

export interface ChangelogSection {
  /** Display label for the section heading. */
  title: string
  kind: SectionKind
  entries: Array<ChangelogEntry>
}

export interface ChangelogRelease {
  version: string
  /** ISO date as written by semantic-release, e.g. `2026-08-03`. */
  date: string | null
  /** The `.../compare/v1.0.0...v1.1.0` link on the version heading. */
  compareUrl: string | null
  sections: Array<ChangelogSection>
}

/**
 * English headings emitted by the preset → what we show, plus a kind used for
 * colour. Matched case-insensitively on the heading with emoji/punctuation
 * stripped, so `### ⚠ BREAKING CHANGES` and `### Bug Fixes` both land.
 */
const SECTION_MAP: Array<{ match: RegExp; title: string; kind: SectionKind }> =
  [
    { match: /breaking/i, title: 'Worth Knowing', kind: 'breaking' },
    { match: /^features?$/i, title: "What's New", kind: 'feature' },
    { match: /^bug fixes?$/i, title: 'Fixes', kind: 'fix' },
    { match: /^performance/i, title: 'Performance', kind: 'other' },
    { match: /^reverts?$/i, title: 'Reverted', kind: 'other' },
    { match: /^documentation$/i, title: 'Documentation', kind: 'other' },
    {
      match: /^(code refactoring|refactor)/i,
      title: 'Refactoring',
      kind: 'other',
    },
    { match: /^tests?$/i, title: 'Tests', kind: 'other' },
    { match: /^(build system|builds?)$/i, title: 'Build', kind: 'other' },
    { match: /^(continuous integration|ci)$/i, title: 'CI', kind: 'other' },
  ]

/** `## [1.2.0](https://…/compare/v1.1.0...v1.2.0) (2026-08-03)` or `## 1.2.0`. */
const VERSION_HEADING =
  /^#{1,3}\s+\[?v?(\d+\.\d+\.\d+(?:-[\w.]+)?)\]?(?:\(([^)]+)\))?\s*(?:\((\d{4}-\d{2}-\d{2})\))?/

/** `### Features`, possibly with a leading emoji. */
const SECTION_HEADING = /^#{3,4}\s+(.+?)\s*$/

/** `* **scope:** description ([abc1234](url))` — every part after the text optional. */
const ENTRY_LINE = /^\s*[*-]\s+(.*)$/

const cleanHeading = (raw: string): string =>
  raw
    // Strip leading emoji / warning signs the preset prefixes headings with.
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[:*_]+$/, '')
    .trim()

const resolveSection = (raw: string): { title: string; kind: SectionKind } => {
  const heading = cleanHeading(raw)
  const hit = SECTION_MAP.find((candidate) => candidate.match.test(heading))
  return hit ?? { title: heading, kind: 'other' }
}

function parseEntry(text: string): ChangelogEntry {
  let rest = text.trim()
  let scope: string | null = null
  let commit: string | null = null
  let commitUrl: string | null = null

  // Leading `**scope:**` (bold) or a bare `scope:` prefix.
  const scoped = /^\*\*(.+?):\*\*\s*/.exec(rest)
  if (scoped) {
    scope = scoped[1].trim()
    rest = rest.slice(scoped[0].length)
  }

  // Trailing `([abc1234](url))`, or a bare `([abc1234])` with no link.
  const linked = /\s*\(\[([0-9a-f]{6,40})\]\(([^)]+)\)\)\s*$/i.exec(rest)
  if (linked) {
    commit = linked[1]
    commitUrl = linked[2]
    rest = rest.slice(0, linked.index)
  } else {
    const bare = /\s*\(\[?([0-9a-f]{7,40})\]?\)\s*$/i.exec(rest)
    if (bare) {
      commit = bare[1]
      rest = rest.slice(0, bare.index)
    }
  }

  return {
    scope,
    // Drop any residual emphasis markers; the text renders as plain text.
    description: rest.replace(/\*\*/g, '').trim(),
    commit,
    commitUrl,
  }
}

/**
 * Parse a changelog into releases, newest first (the order semantic-release
 * writes them in). Returns `[]` for an empty or release-less file — the seeded
 * placeholder must not throw.
 */
export function parseChangelog(markdown: string): Array<ChangelogRelease> {
  const releases: Array<ChangelogRelease> = []
  let release: ChangelogRelease | null = null
  let section: ChangelogSection | null = null

  for (const line of markdown.split(/\r?\n/)) {
    const version = VERSION_HEADING.exec(line)
    if (version) {
      release = {
        version: version[1],
        // Group 2 is the compare URL only when a link was present; when the
        // heading is `## 1.2.0 (2026-08-03)` the date lands in group 2 instead.
        compareUrl:
          version[2] && !/^\d{4}-\d{2}-\d{2}$/.test(version[2])
            ? version[2]
            : null,
        date:
          version[3] ??
          (version[2] && /^\d{4}-\d{2}-\d{2}$/.test(version[2])
            ? version[2]
            : null),
        sections: [],
      }
      releases.push(release)
      section = null
      continue
    }

    // Ignore anything before the first version heading (the file's own title).
    if (!release) continue

    const heading = SECTION_HEADING.exec(line)
    if (heading) {
      const { title, kind } = resolveSection(heading[1])
      section = { title, kind, entries: [] }
      release.sections.push(section)
      continue
    }

    const entry = ENTRY_LINE.exec(line)
    if (entry && entry[1].trim()) {
      // A bullet before any `###` heading (single-section releases do this).
      if (!section) {
        section = { title: 'Changes', kind: 'other', entries: [] }
        release.sections.push(section)
      }
      section.entries.push(parseEntry(entry[1]))
    }
  }

  // A heading with no bullets under it is noise, not a section.
  for (const item of releases) {
    item.sections = item.sections.filter((s) => s.entries.length > 0)
  }
  return releases.filter((item) => item.sections.length > 0)
}

/** Newest version in the file, or null when there are no releases yet. */
export function getLatestVersion(
  releases: Array<ChangelogRelease>,
): string | null {
  return releases[0]?.version ?? null
}

/**
 * Repo URL derived from a compare link, for building commit URLs when an entry
 * has a short SHA but no link of its own.
 */
export function repoUrlFrom(release: ChangelogRelease): string | null {
  if (!release.compareUrl) return null
  const match = /^(https?:\/\/[^/]+\/[^/]+\/[^/]+)/.exec(release.compareUrl)
  return match ? match[1] : null
}
