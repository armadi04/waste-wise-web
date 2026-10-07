import { Input } from '@heroui/react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import type { useResetPassword } from '@/hooks/auth'

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
        <button type="button" onClick={onToggle} className="focus:outline-none">
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
