import { Spinner } from '@heroui/react'

export function LoadingState() {
  return (
    <div className="text-center space-y-4 py-4">
      <Spinner size="lg" color="success" />
      <p className="text-sm text-default-500">Verifying your email address…</p>
    </div>
  )
}
