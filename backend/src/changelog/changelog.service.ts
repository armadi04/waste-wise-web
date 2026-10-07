import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * One published release, as the in-app changelog page consumes it.
 *
 * `notes` is the release body verbatim — semantic-release writes it with the
 * `conventionalcommits` preset, so it already carries the
 * `## [1.2.0](…/compare/v1.1.2...v1.2.0) (2026-08-27)` heading and its
 * `### Features` sections. The frontend concatenates these and runs its
 * existing changelog parser over the result, so the notes format stays the
 * single contract between the two sides.
 */
export interface ReleaseNotes {
  /** Tag name without the `v` prefix, e.g. `1.2.0`. */
  version: string;
  /** Release body markdown, exactly as generated from the commits. */
  notes: string;
  publishedAt: string | null;
  url: string;
}

interface GithubRelease {
  tag_name: string;
  body: string | null;
  published_at: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
}

/**
 * Release notes come from the GitHub Releases API, not from a file in the repo.
 *
 * Keeping them out of the repo means `semantic-release` never has to commit a
 * CHANGELOG.md back to `master`, so no `chore(release)` bot commit lands in front
 * of every release. The SPA reads them through `GET /api/changelog` rather than
 * calling GitHub directly: the token stays server-side (required for a private
 * fork, and it lifts the anonymous rate limit for a public one), and the
 * response is cached so opening the page can't spend a call each time.
 */
@Injectable()
export class ChangelogService {
  private readonly logger = new Logger(ChangelogService.name);

  /** Cached so a page open can't spend a GitHub API call each time. */
  private cache: { at: number; releases: Array<ReleaseNotes> } | null = null;

  private static readonly TTL_MS = 10 * 60 * 1000;

  constructor(private readonly config: ConfigService) {}

  async findAll(): Promise<Array<ReleaseNotes>> {
    if (this.cache && Date.now() - this.cache.at < ChangelogService.TTL_MS) {
      return this.cache.releases;
    }

    const releases = await this.fetchReleases();
    // Only cache a successful read: a rate-limited or unauthenticated call must
    // not pin an empty changelog in front of the page for ten minutes.
    if (releases) {
      this.cache = { at: Date.now(), releases };
      return releases;
    }
    return this.cache?.releases ?? [];
  }

  /** `null` on any failure — the caller decides what to serve instead. */
  private async fetchReleases(): Promise<Array<ReleaseNotes> | null> {
    const repo = this.config.get<string>('GITHUB_REPO');
    const token = this.config.get<string>('GITHUB_TOKEN');

    if (!repo || !token) {
      this.logger.warn(
        'GITHUB_REPO/GITHUB_TOKEN not set — the changelog page will be empty',
      );
      return null;
    }

    try {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/releases?per_page=50`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!response.ok) {
        this.logger.error(
          `GitHub releases request failed: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const payload = (await response.json()) as Array<GithubRelease>;
      return payload
        .filter((release) => !release.draft && !release.prerelease)
        .map((release) => ({
          version: release.tag_name.replace(/^v/, ''),
          notes: release.body ?? '',
          publishedAt: release.published_at,
          url: release.html_url,
        }));
    } catch (error) {
      this.logger.error(
        `GitHub releases request errored: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
