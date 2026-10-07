import { Card, CardBody } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  BadgeDollarSign,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CircleHelp,
  FileClock,
  Gift,
  Heart,
  Layers,
  Megaphone,
  Star,
  Tags,
  Ticket,
} from 'lucide-react'
import { PortalRequestErrorState } from '@/components/features/portal/components/request-error'
import { PageHeader } from '@/components/layout/page-header'
import { useUserPermission } from '@/hooks/permissions'
import { portalDashboardQueryOptions } from '@/lib/query/options'

const cards = [
  ['activeCoupons', 'Active coupons', BadgeDollarSign, 'coupons'],
  ['activeEvents', 'Active events', CalendarDays, 'events'],
  ['activeBundles', 'Active bundles', Layers, 'bundles'],
  ['activeCampaigns', 'Active campaigns', Megaphone, 'campaigns'],
  ['activeFaqs', 'Active FAQs', CircleHelp, 'faqs'],
  ['pendingOrders', 'Pending orders', FileClock, 'orders'],
  ['vouchers', 'Vouchers', Gift, 'vouchers'],
  ['tickets', 'Tickets', Ticket, 'tickets'],
  ['follows', 'Follows', Heart, 'follows'],
  ['campaignProgress', 'Campaign progress', Activity, 'campaign-progress'],
  ['activePromoCodes', 'Active promo codes', Tags, 'promo-codes'],
  ['reviews', 'Reviews', Star, 'reviews'],
  ['bookingSlots', 'Booking slots', CalendarClock, 'booking-slots'],
  ['bookings', 'Bookings', CalendarCheck, 'bookings'],
] as const

export function PortalDashboardPage() {
  const { hasPermission } = useUserPermission()
  const canRead = hasPermission('portal.dashboard.read')
  const { data, isLoading, isError, error, refetch } = useQuery(
    portalDashboardQueryOptions(canRead),
  )

  return (
    <div>
      <PageHeader
        title="Portal"
        description="Manage KuponMalam portal content and operations."
        breadcrumbs={[{ label: 'Portal', isCurrent: true }]}
      />
      {canRead ? (
        isError ? (
          <PortalRequestErrorState
            error={error}
            onRetry={() => {
              void refetch()
            }}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {cards.map(([key, label, Icon, resource]) => (
              <Card
                key={key}
                as={Link}
                to={`/portal/${resource}`}
                isPressable
                className="border border-default-100"
              >
                <CardBody className="flex flex-row items-center justify-between gap-3 p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-default-400">
                      {label}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-default-800">
                      {isLoading ? '—' : (data?.[key] ?? 0)}
                    </p>
                  </div>
                  <Icon size={22} className="text-primary" />
                </CardBody>
              </Card>
            ))}
          </div>
        )
      ) : (
        <Card>
          <CardBody className="text-sm text-default-500">
            No portal dashboard permission.
          </CardBody>
        </Card>
      )}
    </div>
  )
}
