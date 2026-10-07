import { Button, Chip, Skeleton } from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { TwoFactorModal } from '@/components/features/profile/modal/two-factor-modal'
import { useAuth } from '@/hooks/auth'
import { useTwoFactor } from '@/hooks/profile'

/** Account security actions: password recovery and ending the session. */
export function ProfileSecurityCard() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const twoFactor = useTwoFactor()
  const isOn = !!twoFactor.status?.enabled

  return (
    <section>
      <h3 className="mb-4 text-lg font-semibold tracking-tight">Security</h3>

      <div className="flex flex-col divide-y divide-default-100">
        <div className="flex items-center gap-3 pb-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-medium bg-primary/10">
            <KeyRound size={16} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Password</p>
            <p className="text-xs text-default-400">
              Change it through the emailed reset link
            </p>
          </div>
          <Button
            size="sm"
            variant="flat"
            color="primary"
            className="shrink-0 font-medium"
            onPress={() => void navigate({ to: '/forgot-password' })}
          >
            Reset
          </Button>
        </div>

        <div className="flex items-center gap-3 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-medium bg-primary/10">
            <ShieldCheck size={16} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                Two-factor authentication
              </p>
              {twoFactor.isLoading ? (
                <Skeleton className="h-5 w-10 rounded-full" />
              ) : (
                <Chip
                  size="sm"
                  variant="flat"
                  color={isOn ? 'success' : 'default'}
                >
                  {isOn ? 'On' : 'Off'}
                </Chip>
              )}
            </div>
            <p className="text-xs text-default-400">
              {isOn
                ? `${twoFactor.status?.recoveryCodesRemaining ?? 0} recovery codes left`
                : 'Require a code from your authenticator app at sign-in'}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {isOn && (
              <Button
                size="sm"
                variant="flat"
                className="font-medium"
                onPress={twoFactor.startRegenerate}
              >
                New codes
              </Button>
            )}
            <Button
              size="sm"
              variant="flat"
              color={isOn ? 'danger' : 'primary'}
              className="font-medium"
              isLoading={twoFactor.isStarting}
              onPress={isOn ? twoFactor.startDisable : twoFactor.startSetup}
            >
              {isOn ? 'Turn off' : 'Turn on'}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-medium bg-danger/10">
            <LogOut size={16} className="text-danger" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Sign out</p>
            <p className="text-xs text-default-400">
              End the session on this device
            </p>
          </div>
          <Button
            size="sm"
            color="danger"
            variant="flat"
            className="shrink-0 font-medium"
            onPress={() => logout()}
          >
            Sign out
          </Button>
        </div>
      </div>

      <TwoFactorModal
        step={twoFactor.step}
        onClose={twoFactor.close}
        code={twoFactor.code}
        setCode={twoFactor.setCode}
        enrollment={twoFactor.enrollment}
        recoveryCodes={twoFactor.recoveryCodes}
        onConfirm={twoFactor.confirm}
        onDisable={twoFactor.disable}
        onRegenerate={twoFactor.regenerate}
        isConfirming={twoFactor.isConfirming}
        isDisabling={twoFactor.isDisabling}
        isRegenerating={twoFactor.isRegenerating}
      />
    </section>
  )
}
