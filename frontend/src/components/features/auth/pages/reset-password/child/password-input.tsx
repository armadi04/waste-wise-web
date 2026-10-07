import { Eye, EyeOff, Lock } from 'lucide-react'
import type { useResetPassword } from '@/hooks/auth'
import { Input } from '@/components/shared/controls'

export function PasswordInput({
  label,
  registration,
  isVisible,
  onToggle,
  isInvalid,
  errorMessage,
}: {
  label: string
  registration: ReturnType<ReturnType<typeof useResetPassword>['register']>
  isVisible: boolean
  onToggle: () => void
  isInvalid: boolean
  errorMessage?: string
}) {
  return (
    <Input
      {...registration}
      label={label}
      placeholder="••••••••••••"
      type={isVisible ? 'text' : 'password'}
      startContent={<Lock className="w-4 h-4 text-default-400" />}
      endContent={
        <button
          type="button"
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          onClick={onToggle}
          className="focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
        >
          {isVisible ? (
            <EyeOff className="w-4 h-4 text-default-400" />
          ) : (
            <Eye className="w-4 h-4 text-default-400" />
          )}
        </button>
      }
      variant="bordered"
      labelPlacement="outside"
      isRequired
      isInvalid={isInvalid}
      errorMessage={errorMessage}
    />
  )
}
