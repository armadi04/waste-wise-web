import { ShieldCheck } from 'lucide-react'
import type { useLogin } from '@/hooks/auth'
import { Button, Input } from '@/components/shared/controls'
import { AuthPageShell } from '@/components/layout/auth-page-shell'

type Props = Pick<
  ReturnType<typeof useLogin>,
  | 'isLoading'
  | 'twoFactorCode'
  | 'setTwoFactorCode'
  | 'onVerifyTwoFactor'
  | 'cancelTwoFactor'
>
export function LoginTwoFactorForm({
  isLoading,
  twoFactorCode,
  setTwoFactorCode,
  onVerifyTwoFactor,
  cancelTwoFactor,
}: Props) {
  return (
    <AuthPageShell>
      <div className="space-y-3">
        <span className="text-xs font-semibold tracking-widest text-default-500 uppercase">
          Two-factor authentication
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
          Enter your code
        </h1>
        <p className="text-sm text-default-500">
          Open your authenticator app and enter the 6-digit code. You can also
          use one of your recovery codes.
        </p>
      </div>

      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void onVerifyTwoFactor()
        }}
      >
        <Input
          value={twoFactorCode}
          onValueChange={setTwoFactorCode}
          label="Authentication code"
          placeholder="123456"
          autoFocus
          autoComplete="one-time-code"
          inputMode="text"
          startContent={<ShieldCheck className="h-4 w-4 text-default-400" />}
          variant="bordered"
          labelPlacement="outside"
          isRequired
          classNames={{ inputWrapper: 'h-12' }}
        />

        <Button
          color="primary"
          type="submit"
          className="h-12 w-full bg-primary font-medium text-primary-foreground hover:bg-primary-700 "
          isLoading={isLoading}
          isDisabled={isLoading || twoFactorCode.trim().length < 6}
          startContent={!isLoading && <ShieldCheck className="h-4 w-4" />}
        >
          Verify
        </Button>

        <Button variant="light" onPress={cancelTwoFactor}>
          Back to sign in
        </Button>
      </form>
    </AuthPageShell>
  )
}
