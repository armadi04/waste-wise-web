import { Skeleton } from '@heroui/react'
import { formatDistanceToNow } from 'date-fns'
import { Monitor, Smartphone } from 'lucide-react'
import { Button, Chip } from '@/components/shared/controls'
import { describeUserAgent, isMobileUserAgent } from '@/lib/utils/user-agent'
import { useMySessionsCard } from '@/hooks/sessions'

/**
 * The devices currently signed in as this user, with a way to end any of them.
 * The current device can't be revoked here — that's what Sign out is for.
 */
export function ProfileSessionsCard() {
  const {
    sessions,
    isLoading,
    onRevoke,
    onRevokeOthers,
    pendingId,
    isRevokingOthers,
  } = useMySessionsCard()

  const otherCount = sessions.filter((s) => !s.isCurrent).length

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">
            Active Sessions
          </h3>
          <p className="text-xs text-default-400">
            Devices signed in to your account
          </p>
        </div>
        {otherCount > 0 && (
          <Button
            size="sm"
            variant="flat"
            color="danger"
            className="shrink-0 font-medium"
            isLoading={isRevokingOthers}
            onPress={() => void onRevokeOthers()}
          >
            Sign out others
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-medium" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-default-500 italic">No active sessions</p>
      ) : (
        <div className="flex flex-col divide-y divide-default-100">
          {sessions.map((session) => {
            const Icon = isMobileUserAgent(session.userAgent)
              ? Smartphone
              : Monitor

            return (
              <div
                key={session.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-medium bg-[var(--app-selected-background)]">
                  <Icon size={16} className="text-[var(--app-link)]" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {describeUserAgent(session.userAgent)}
                    </p>
                    {session.isCurrent && (
                      <Chip size="sm" variant="flat" color="success">
                        This device
                      </Chip>
                    )}
                  </div>
                  <p className="truncate text-xs text-default-400">
                    {session.ipAddress ?? 'Unknown IP'} · active{' '}
                    {formatDistanceToNow(new Date(session.lastActiveAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>

                {!session.isCurrent && (
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    className="shrink-0 font-medium"
                    isLoading={pendingId === session.id}
                    onPress={() => void onRevoke(session.id)}
                  >
                    Sign out
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
