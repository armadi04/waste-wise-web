import { useState } from 'react'
import { addToast } from '@/components/shared/controls/toast'
import { useAuth } from '@/hooks/auth/use-auth'

/**
 * Starting or ending an impersonation swaps who the session belongs to, which
 * invalidates everything the running app holds: cached queries, the chosen
 * role, the notifications socket. Rather than chase each of those, both
 * directions reload onto the dashboard — the same thing `logout()` does, and
 * for the same reason.
 */
export const useImpersonation = () => {
  const { user, impersonate, stopImpersonating } = useAuth()
  const [isSwitching, setIsSwitching] = useState(false)

  const apply = async (
    action: () => Promise<{ success: boolean; error?: string }>,
    failureTitle: string,
  ) => {
    setIsSwitching(true)
    const result = await action()
    if (result.success) {
      window.location.assign('/')
      return result
    } else {
      addToast({
        title: failureTitle,
        description: result.error,
        color: 'danger',
      })
    }
    setIsSwitching(false)
    return result
  }

  return {
    isImpersonating: !!user?.impersonatorId,
    isSwitching,
    start: (userId: number) =>
      apply(() => impersonate(userId), 'Could not sign in as that user'),
    stop: () => apply(stopImpersonating, 'Could not return to your account'),
  }
}
