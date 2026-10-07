import { Link } from '@tanstack/react-router'

export function BackToLogin() {
  return (
    <Link
      to="/login"
      className="text-sm text-default-500 hover:text-[var(--app-link)] transition-colors"
    >
      Back to Login
    </Link>
  )
}
