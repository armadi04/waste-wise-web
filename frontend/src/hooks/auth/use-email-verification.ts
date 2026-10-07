import { useAuth, useProfile } from '@/hooks/auth/use-auth'

/**
 * Resolves whether the current user still needs to verify their email.
 *
 * While the profile is loading, the JWT payload is used as the fast initial
 * check so there is no flash of unblocked content. Once the profile arrives,
 * the DB value is authoritative (handles stale or missing JWT fields).
 */
export function useEmailVerificationStatus() {
  const { isAuthenticated, user } = useAuth()
  const { data: profile, isLoading } = useProfile()

  const emailVerified = isLoading
    ? (user?.emailVerified ?? false)
    : profile?.emailVerifiedAt != null

  return {
    email: user?.email,
    needsVerification: isAuthenticated && !!user && !emailVerified,
  }
}
