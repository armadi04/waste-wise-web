import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

export function BackToLogin() {
  return (
    <div className="flex justify-center">
      <Link
        to="/login"
        className="flex items-center gap-1.5 text-sm text-default-500 hover:text-[var(--app-link)] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Login
      </Link>
    </div>
  )
}
