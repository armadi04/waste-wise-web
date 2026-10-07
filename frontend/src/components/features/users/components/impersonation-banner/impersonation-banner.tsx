import { Button } from '@heroui/react'
import { UserCog } from 'lucide-react'
import { useAuth } from '@/hooks/auth'
import { useImpersonation } from '@/hooks/users'

/**
 * Always-visible reminder that this session belongs to an administrator signed
 * in as someone else — without it, every destructive action on the page would
 * look like the user's own. Floats at the bottom so it never pushes the app's
 * own chrome around.
 */
export function ImpersonationBanner() {
  const { user } = useAuth()
  const { isImpersonating, isSwitching, stop } = useImpersonation()

  if (!isImpersonating) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-primary py-2 pr-2 pl-4 text-primary-foreground shadow-lg">
        <UserCog size={16} className="shrink-0" />
        <p className="truncate text-sm font-medium">
          Signed in as {user?.email}
        </p>
        <Button
          size="sm"
          radius="full"
          className="bg-primary-foreground font-medium text-primary"
          isLoading={isSwitching}
          onPress={() => void stop()}
        >
          Return to your account
        </Button>
      </div>
    </div>
  )
}
