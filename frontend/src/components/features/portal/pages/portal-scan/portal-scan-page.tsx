import { Card, CardBody } from '@heroui/react'
import { PassScanner } from '@/components/features/portal/components/pass-scanner'
import { PageHeader } from '@/components/layout/page-header'
import { usePassScan } from '@/hooks/portal'

export function PortalScanPage() {
  const scan = usePassScan()
  return (
    <div>
      <PageHeader
        title="Scan pass"
        description="Redeem vouchers and check in tickets from customer QR codes."
        breadcrumbs={[
          { label: 'Portal', href: '/portal' },
          { label: 'Scan pass', isCurrent: true },
        ]}
      />
      {scan.canRedeem || scan.canCheckIn ? (
        <PassScanner {...scan} />
      ) : (
        <Card>
          <CardBody className="text-sm text-default-500">
            No pass verification permission.
          </CardBody>
        </Card>
      )}
    </div>
  )
}
