import { Mail } from 'lucide-react'
import { BackToLogin } from '@/components/features/auth/pages/forgot-password/child/back-to-login'

export function SuccessState() {
  return (
    <>
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Check your email
          </h1>
          <p className="text-sm text-default-500 leading-relaxed">
            If an account exists for that email, we've sent a password reset
            link. The link expires in 30 minutes.
          </p>
        </div>
        <p className="text-xs text-default-400">
          Didn't receive an email? Check your spam folder.
        </p>
      </div>

      <BackToLogin />
    </>
  )
}
