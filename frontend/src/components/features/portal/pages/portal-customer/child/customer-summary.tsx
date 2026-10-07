import type { PortalCustomerSummary } from '@/lib/services/portal.service'
import { Stat } from '@/components/features/portal/pages/portal-customer/child/stat'
import { formatDateTime } from '@/lib/utils/format'

export function CustomerSummary({
  customer,
}: {
  customer: PortalCustomerSummary
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Email" value={customer.email} />
      <Stat label="Phone" value={customer.phone ?? '—'} />
      <Stat label="Joined" value={formatDateTime(String(customer.createdAt))} />
      <Stat label="Registered via" value={customer.registerMethod} />
      <Stat
        label="Wallet balance"
        value={`${customer.walletBalance.toLocaleString('id-ID')} coins`}
      />
      <Stat
        label="Lifetime earned"
        value={`${customer.lifetimeEarned.toLocaleString('id-ID')} coins`}
      />
      <Stat
        label="Orders (paid)"
        value={`${customer.orderCount} (${customer.paidOrderCount})`}
      />
      <Stat
        label="Last order"
        value={
          customer.lastOrderAt
            ? formatDateTime(String(customer.lastOrderAt))
            : '—'
        }
      />
      <Stat
        label="Vouchers · tickets"
        value={`${customer.voucherCount} · ${customer.ticketCount}`}
      />
      <Stat
        label="Bookings · gifts sent"
        value={`${customer.bookingCount} · ${customer.giftsSent}`}
      />
      <Stat label="Referral code" value={customer.referralCode ?? '—'} />
      <Stat
        label="Referred by · referred"
        value={`${customer.referredByUserId ? `#${customer.referredByUserId}` : '—'} · ${customer.referredCount}`}
      />
      <Stat
        label="Notifications"
        value={customer.notificationsEnabled ? 'Enabled' : 'Disabled'}
      />
    </div>
  )
}
