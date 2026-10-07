import { AlertTriangle } from 'lucide-react'
import { BackToLogin } from '@/components/features/auth/pages/accept-invite/child/back-to-login'

export function InvalidInviteState() {
  return (
    <div className="text-center space-y-4">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full app-status-danger bg-[var(--app-danger-background)] text-[var(--app-danger-foreground)] flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-[var(--app-danger)]" />
        </div>
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Invalid Invitation
        </h1>
        <p className="text-sm text-default-500 leading-relaxed">
          This invitation link is missing, invalid, or has expired. Please ask
          an administrator to send you a new one.
        </p>
      </div>
      <BackToLogin />
    </div>
  )
}
