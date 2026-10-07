import { Card, CardBody, Tab, Tabs } from '@heroui/react'
import type { CUSTOMER_TABS } from '@/lib/schemas/portal'
import { PortalRequestErrorState } from '@/components/features/portal/components/request-error'
import { portalResourceConfig } from '@/components/features/portal/lib/config'
import {
  CustomerRecords,
  CustomerSummary,
} from '@/components/features/portal/pages/portal-customer/child'
import { PageHeader } from '@/components/layout/page-header'
import { TableSkeleton } from '@/components/shared/datatable/skeletons'
import { usePortalCustomerPage } from '@/hooks/portal'

export function PortalCustomerPage() {
  const page = usePortalCustomerPage()
  const customer = page.customer.data
  const title = customer
    ? customer.fullname || customer.email
    : `Customer #${page.customerId}`
  return (
    <div className="grid gap-4">
      <PageHeader
        title={title}
        description="Portal activity for this customer."
        breadcrumbs={[
          { label: 'Portal', href: '/portal' },
          { label: 'Customers', href: '/portal/customers' },
          { label: title, isCurrent: true },
        ]}
      />
      {!page.canRead ? (
        <Card>
          <CardBody className="text-sm text-default-500">
            No portal customer permission.
          </CardBody>
        </Card>
      ) : page.customer.isError ? (
        <PortalRequestErrorState
          error={page.customer.error}
          onRetry={() => {
            void page.customer.refetch()
          }}
        />
      ) : customer ? (
        <CustomerSummary customer={customer} />
      ) : (
        <TableSkeleton rows={3} columns={4} />
      )}
      {page.canRead && page.tab && (
        <Card className="border border-default-100">
          <CardBody className="gap-4">
            <Tabs
              aria-label="Customer records"
              selectedKey={page.tab}
              variant="underlined"
              onSelectionChange={(key) =>
                page.onTabChange(key as (typeof CUSTOMER_TABS)[number])
              }
            >
              {page.tabs.map((tab) => (
                <Tab
                  key={tab}
                  title={portalResourceConfig(tab)?.label ?? tab}
                />
              ))}
            </Tabs>
            <CustomerRecords
              tab={page.tab}
              page={page.page}
              onPageChange={page.onPageChange}
              records={page.records}
            />
          </CardBody>
        </Card>
      )}
    </div>
  )
}
