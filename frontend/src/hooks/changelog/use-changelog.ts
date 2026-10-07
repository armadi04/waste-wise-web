import { useQuery } from '@tanstack/react-query'
import { changelogQueryOptions } from '@/lib/query/options'

import { getLatestVersion, parseChangelog } from '@/lib/utils/changelog'

/**
 * Release history, read from the GitHub Releases API through the backend.
 *
 * The notes are server state, so they come through react-query like anything
 * else and the version badge is a hook rather than a module constant.
 *
 * The backend returns each release's notes verbatim, newest first, in exactly
 * the format the changelog parser reads — so concatenating them reproduces the
 * document a committed CHANGELOG.md would have held.
 */
export const useChangelog = () => {
  const query = useQuery(changelogQueryOptions())

  const releases = parseChangelog(
    (query.data ?? []).map((release) => release.notes).join('\n\n'),
  )

  return { ...query, releases, version: getLatestVersion(releases) }
}
