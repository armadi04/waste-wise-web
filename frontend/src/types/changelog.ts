/**
 * One published release as `GET /api/v1/changelog` returns it.
 *
 * `notes` is the GitHub Release body verbatim — semantic-release generates it
 * with the `conventionalcommits` preset, so it already carries its own
 * `## [1.2.0](…/compare/v1.1.2...v1.2.0) (2026-08-27)` heading. That's why the
 * page can feed the concatenated notes straight into `parseChangelog`.
 */
export interface ReleaseNotes {
  /** Tag name without the `v` prefix, e.g. `1.2.0`. */
  version: string
  notes: string
  publishedAt: string | null
  url: string
}
