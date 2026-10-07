import { describe, expect, it } from 'vitest'
import {
  getLatestVersion,
  parseChangelog,
  repoUrlFrom,
} from '@/lib/utils/changelog'

/** Verbatim shape of what semantic-release's conventionalcommits preset emits. */
const REAL = `# Changelog

## [1.1.0](https://github.com/univSTEKOM/spmi/compare/v1.0.0...v1.1.0) (2026-08-10)

### Features

* **repository:** batch/folder upload, bulk ops, and ZIP download ([46288e1](https://github.com/univSTEKOM/spmi/commit/46288e1))
* add a thing with no scope ([88e82c2](https://github.com/univSTEKOM/spmi/commit/88e82c2))

### Bug Fixes

* **repository:** marquee selection never armed ([00a8bac](https://github.com/univSTEKOM/spmi/commit/00a8bac))

## 1.0.0 (2026-08-03)

### ⚠ BREAKING CHANGES

* **api:** the alumni endpoint response changed

### Features

* initial release
`

/** The file committed before the first release ever runs. */
const PLACEHOLDER = `# Changelog

Belum ada rilis. Berkas ini ditimpa otomatis oleh \`semantic-release\` pada setiap
rilis — jangan sunting manual. Lihat [RELEASING.md](../../../RELEASING.md).
`

describe('parseChangelog', () => {
  it('returns releases newest-first with dates and compare links', () => {
    const releases = parseChangelog(REAL)
    expect(releases.map((r) => r.version)).toEqual(['1.1.0', '1.0.0'])
    expect(releases[0].date).toBe('2026-08-10')
    expect(releases[0].compareUrl).toBe(
      'https://github.com/univSTEKOM/spmi/compare/v1.0.0...v1.1.0',
    )
  })

  it('maps English section headings to Indonesian labels and kinds', () => {
    const [latest, first] = parseChangelog(REAL)
    expect(latest.sections.map((s) => [s.title, s.kind])).toEqual([
      ["What's New", 'feature'],
      ['Fixes', 'fix'],
    ])
    // The emoji prefix on '### ⚠ BREAKING CHANGES' must not defeat the match.
    expect(first.sections[0]).toMatchObject({
      title: 'Worth Knowing',
      kind: 'breaking',
    })
  })

  it('splits scope, description and commit link out of an entry', () => {
    const entry = parseChangelog(REAL)[0].sections[0].entries[0]
    expect(entry).toEqual({
      scope: 'repository',
      description: 'batch/folder upload, bulk ops, and ZIP download',
      commit: '46288e1',
      commitUrl: 'https://github.com/univSTEKOM/spmi/commit/46288e1',
    })
  })

  it('handles an entry with no scope', () => {
    const entry = parseChangelog(REAL)[0].sections[0].entries[1]
    expect(entry.scope).toBeNull()
    expect(entry.description).toBe('add a thing with no scope')
  })

  it('handles an entry with no commit link', () => {
    const entry = parseChangelog(REAL)[1].sections[1].entries[0]
    expect(entry).toMatchObject({
      scope: null,
      description: 'initial release',
      commit: null,
      commitUrl: null,
    })
  })

  it('reads a bare `## 1.0.0 (date)` heading, where the date is not a link', () => {
    const release = parseChangelog(REAL)[1]
    expect(release.version).toBe('1.0.0')
    expect(release.date).toBe('2026-08-03')
    expect(release.compareUrl).toBeNull()
  })

  it('yields an empty list for the seeded placeholder rather than throwing', () => {
    expect(parseChangelog(PLACEHOLDER)).toEqual([])
    expect(parseChangelog('')).toEqual([])
  })

  it('drops a section heading that has no entries under it', () => {
    const releases = parseChangelog(`## 1.0.0 (2026-01-01)

### Features

### Bug Fixes

* **a:** real one ([abc1234](https://x/y/commit/abc1234))
`)
    expect(releases[0].sections.map((s) => s.title)).toEqual(['Fixes'])
  })

  it('keeps an unknown heading as its own other-kind section', () => {
    const releases = parseChangelog(`## 2.0.0 (2026-01-01)

### Something Unusual

* kept anyway
`)
    expect(releases[0].sections[0]).toMatchObject({
      title: 'Something Unusual',
      kind: 'other',
    })
  })

  it('accepts bullets that appear before any section heading', () => {
    const releases = parseChangelog(`## 1.0.1 (2026-01-02)

* **x:** loose bullet ([def5678](https://x/y/commit/def5678))
`)
    expect(releases[0].sections[0]).toMatchObject({ title: 'Changes' })
    expect(releases[0].sections[0].entries[0].scope).toBe('x')
  })

  it('parses a prerelease version', () => {
    expect(
      parseChangelog(`## 1.1.0-beta.1 (2026-01-01)\n\n* a thing\n`)[0].version,
    ).toBe('1.1.0-beta.1')
  })
})

describe('getLatestVersion', () => {
  it('returns the newest version, or null when there are none', () => {
    expect(getLatestVersion(parseChangelog(REAL))).toBe('1.1.0')
    expect(getLatestVersion([])).toBeNull()
  })
})

describe('repoUrlFrom', () => {
  it('derives the repo origin from a compare link', () => {
    expect(repoUrlFrom(parseChangelog(REAL)[0])).toBe(
      'https://github.com/univSTEKOM/spmi',
    )
  })

  it('returns null when the release has no compare link', () => {
    expect(repoUrlFrom(parseChangelog(REAL)[1])).toBeNull()
  })
})
