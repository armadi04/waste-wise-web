import { Button, Card, CardBody } from '@heroui/react'
import { RefreshCw, TriangleAlert } from 'lucide-react'

interface PortalRequestErrorStateProps {
  error: unknown
  onRetry: () => void
}

interface ApiErrorShape {
  response?: {
    status?: number
    data?: { message?: string | Array<string> }
  }
  message?: string
}

export const portalRequestErrorMessage = (error: unknown) => {
  const apiError = error as ApiErrorShape
  const status = apiError?.response?.status
  const message = apiError?.response?.data?.message
  const detail = Array.isArray(message) ? message.join(', ') : message

  if (status)
    return `Request failed (${status}): ${detail ?? 'Please try again.'}`
  return detail ?? apiError?.message ?? 'Portal data could not be loaded.'
}

export function PortalRequestErrorState({
  error,
  onRetry,
}: PortalRequestErrorStateProps) {
  return (
    <Card className="border border-danger-200 bg-danger-50/40">
      <CardBody className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <TriangleAlert size={22} className="mt-0.5 shrink-0 text-danger" />
          <div>
            <p className="font-semibold text-danger-700">
              Portal data unavailable
            </p>
            <p className="mt-1 text-sm text-default-600">
              {portalRequestErrorMessage(error)}
            </p>
          </div>
        </div>
        <Button
          color="danger"
          variant="flat"
          startContent={<RefreshCw size={16} />}
          onPress={onRetry}
        >
          Retry
        </Button>
      </CardBody>
    </Card>
  )
}
