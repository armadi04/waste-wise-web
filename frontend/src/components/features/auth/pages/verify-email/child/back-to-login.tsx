import { Link } from '@tanstack/react-router'

export function BackToLogin() {
  return (
    <Link
      to="/login"
      className="text-sm text-default-500 hover:text-primary transition-colors"
    >
      Back to Login
    </Link>
  )
}
