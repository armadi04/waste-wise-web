import type { SectionKind } from '@/lib/utils/changelog'

/**
 * Friendly names for conventional-commit scopes.
 *
 * The changelog is read by users, not developers, so a raw `oauth`
 * scope means little to them. Anything missing here falls back to the raw
 * scope — add an entry when a new scope starts appearing in releases.
 */
export const SCOPE_LABELS: Record<string, string> = {
  auth: 'Sign-in & Access',
  oauth: 'OAuth Clients',
  users: 'Users',
  roles: 'Roles',
  permissions: 'Permissions',
  invitations: 'Invitations',
  media: 'Media Library',
  notifications: 'Notifications',
  sessions: 'Sessions',
  dashboard: 'Dashboard',
  profile: 'Profile',
  settings: 'Settings',
  datatable: 'Data Tables',
  frontend: 'Interface',
  backend: 'API',
  graphql: 'GraphQL API',
  ui: 'Interface',
  seeder: 'Seed Data',
  deps: 'Dependencies',
  changelog: 'Changelog',
}

export const scopeLabel = (scope: string): string =>
  SCOPE_LABELS[scope.toLowerCase()] ?? scope

/** Per-section colour + a one-line explanation of what the group means. */
export const SECTION_STYLE: Record<
  SectionKind,
  { dot: string; text: string; hint: string }
> = {
  feature: {
    dot: 'bg-primary',
    text: 'text-primary',
    hint: 'New things you can start using right away.',
  },
  fix: {
    dot: 'bg-success',
    text: 'text-success',
    hint: 'Things that used to get in the way, now sorted.',
  },
  breaking: {
    dot: 'bg-danger',
    text: 'text-danger',
    hint: 'Something you rely on may work a little differently.',
  },
  other: {
    dot: 'bg-default-400',
    text: 'text-default-500',
    hint: 'Technical changes behind the scenes.',
  },
}

/**
 * Commit subjects are written for other developers, so tidy them for display:
 * capitalize the first letter and drop a trailing period. Writing
 * release-worthy subjects stays a commit-message discipline.
 */
export const tidyDescription = (text: string): string => {
  const trimmed = text.replace(/\s*\.\s*$/, '').trim()
  return trimmed ? trimmed[0].toUpperCase() + trimmed.slice(1) : trimmed
}
