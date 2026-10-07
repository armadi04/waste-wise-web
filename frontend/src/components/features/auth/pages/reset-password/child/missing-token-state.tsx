import { Link } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'

export function MissingTokenState() {
  return (
    <div className="text-center space-y-4">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full app-status-danger bg-[var(--app-danger-background)] text-[var(--app-danger-foreground)] flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-[var(--app-danger)]" />
        </div>
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Invalid Reset Link
        </h1>
        <p className="text-sm text-default-500 leading-relaxed">
          This password reset link is missing or invalid. Please request a new
          one.
        </p>
      </div>
      <Link
        to="/forgot-password"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--app-link)] hover:text-[var(--app-link-hover)] hover:underline transition-colors font-medium"
      >
        Request a new link
      </Link>
    </div>
  )
}
