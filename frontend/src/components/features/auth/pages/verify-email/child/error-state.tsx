import { Button, Input, Spinner } from '@heroui/react'
import { AlertTriangle, CheckCircle, Mail } from 'lucide-react'
import { useState } from 'react'
import { useResendVerification } from '@/hooks/auth'
import { BackToLogin } from '@/components/features/auth/pages/verify-email/child/back-to-login'

export function ErrorState({ message }: { message: string }) {
  const [email, setEmail] = useState('')
  const { state, resend } = useResendVerification()

  if (state === 'sent') {
    return (
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Email Sent
          </h1>
          <p className="text-sm text-default-500 leading-relaxed">
            If <span className="font-medium text-default-700">{email}</span> is
            registered and unverified, a new link has been sent. Check your
            inbox and spam folder.
          </p>
        </div>
        <BackToLogin />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-danger" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Verification Failed
          </h1>
          <p className="text-sm text-default-500 leading-relaxed">
            {message ||
              'The verification link is invalid, expired, or already used.'}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-default-700">
          Resend verification email
        </p>
        <Input
          type="email"
          placeholder="Enter your email address"
          value={email}
          onValueChange={setEmail}
          variant="bordered"
          classNames={{ inputWrapper: 'border-default-200' }}
        />
        {state === 'error' && (
          <p className="text-xs text-danger">
            Failed to send. Please try again.
          </p>
        )}
        <Button
          className="w-full h-11 bg-primary hover:bg-primary-700 text-primary-foreground font-medium"
          startContent={
            state === 'loading' ? (
              <Spinner size="sm" color="white" />
            ) : (
              <Mail className="w-4 h-4" />
            )
          }
          isDisabled={state === 'loading' || !email.trim()}
          onPress={() => void resend(email)}
        >
          {state === 'loading' ? 'Sending…' : 'Resend Verification Email'}
        </Button>
      </div>

      <div className="text-center">
        <BackToLogin />
      </div>
    </div>
  )
}
