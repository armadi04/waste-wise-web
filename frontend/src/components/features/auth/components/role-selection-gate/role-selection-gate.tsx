import { Spinner } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/shared/controls'
import { AuthPageShell } from '@/components/layout/auth-page-shell'
import { useAuth, useProfile } from '@/hooks/auth'
import { getRememberedActiveRole } from '@/lib/utils/active-role'

/**
 * Blocks the app behind a role picker for authenticated users who hold more
 * than one role and have not yet chosen which one to act as. Single-role users
 * (auto-scoped server-side) and users who already picked see `children`.
 *
 * A previously remembered, still-assigned role is applied silently so returning
 * users skip the screen. This is the UX layer — the backend independently
 * scopes permissions to the chosen role via the JWT.
 */
export function RoleSelectionGate({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = useProfile()
  const { user, switchRole, isAuthenticated } = useAuth()
  const activeRole = user?.activeRole
  const roles = profile?.roles ?? []
  const needsChoice = roles.length > 1 && !activeRole

  const [switching, setSwitching] = useState<string | null>(null)
  // Guards the silent re-apply so a failed switch (network/500, role revoked)
  // falls through to the manual picker instead of retrying every render.
  const autoAppliedRef = useRef(false)

  // Re-apply the last choice without prompting, when it is still valid.
  useEffect(() => {
    if (!needsChoice || !user || switching || autoAppliedRef.current) return
    const remembered = getRememberedActiveRole(user.sub)
    if (remembered && roles.some((r) => r.name === remembered)) {
      autoAppliedRef.current = true
      setSwitching(remembered)
      void switchRole(remembered).finally(() => setSwitching(null))
    }
  }, [needsChoice, user, roles, switchRole, switching])

  const choose = (role: string) => {
    setSwitching(role)
    void switchRole(role).finally(() => setSwitching(null))
  }

  // Logging out clears `user` while the profile query still holds its last
  // result, which used to make the picker flash over the app on the way to the
  // login page. No session, nothing to gate.
  if (!isAuthenticated || !user) {
    return <>{children}</>
  }

  // Already acting as a role → render the app immediately rather than waiting
  // on the profile query, whose refetch would flash the loading screen.
  if (activeRole) {
    return <>{children}</>
  }

  // No active role yet: we need the profile to know how many roles the user has.
  if (isLoading) {
    return (
      <AuthPageShell morph={false}>
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </AuthPageShell>
    )
  }

  if (!needsChoice) {
    return <>{children}</>
  }

  return (
    <AuthPageShell morph={false}>
      <div className="flex flex-col gap-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-default-900">
            Choose a role
          </h1>
          <p className="text-sm leading-relaxed text-default-500">
            Your account holds more than one role. Pick the one you want to act
            as — you can switch later from the profile menu.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {roles.map((role) => (
            <Button
              key={role.id}
              variant="bordered"
              className="h-auto w-full justify-start border-default-200 px-4 py-3"
              isDisabled={switching !== null}
              endContent={
                switching === role.name ? <Spinner size="sm" /> : null
              }
              onPress={() => choose(role.name)}
            >
              <span className="flex flex-1 flex-col items-start">
                <span className="font-medium capitalize text-default-800">
                  {role.name}
                </span>
                {role.description && (
                  <span className="text-xs text-default-500">
                    {role.description}
                  </span>
                )}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </AuthPageShell>
  )
}
