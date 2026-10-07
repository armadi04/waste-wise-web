import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { PortalCustomerSearchParams } from '@/lib/schemas/portal'
import { portalResourceConfig } from '@/components/features/portal/lib/config'
import { useUserPermission } from '@/hooks/permissions/use-permissions'
import {
  portalCustomerQueryOptions,
  portalCustomerRecordsQueryOptions,
} from '@/lib/query/options'
import { CUSTOMER_TABS } from '@/lib/schemas/portal'

const routeApi = getRouteApi('/(portal)/portal/customers/$customerId')

export const usePortalCustomerPage = () => {
  const { customerId: rawId } = routeApi.useParams()
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { hasPermission } = useUserPermission()
  const customerId = Number(rawId)
  const tabs = CUSTOMER_TABS.filter((tab) =>
    hasPermission(`${portalResourceConfig(tab)?.permission}.read`),
  )
  const tab = search.tab && tabs.includes(search.tab) ? search.tab : tabs[0]
  const page = search.page ?? 1
  const canRead = hasPermission('portal.customers.read')
  const customer = useQuery(portalCustomerQueryOptions(customerId, canRead))
  const records = useQuery(
    portalCustomerRecordsQueryOptions(
      tab ?? 'orders',
      customerId,
      page,
      Boolean(tab),
    ),
  )
  const setSearch = (next: PortalCustomerSearchParams) => {
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true })
  }
  return {
    customerId,
    canRead,
    customer,
    tabs,
    tab,
    page,
    records,
    config: tab ? portalResourceConfig(tab) : undefined,
    onTabChange: (next: (typeof CUSTOMER_TABS)[number]) =>
      setSearch({ tab: next, page: 1 }),
    onPageChange: (next: number) => setSearch({ page: next }),
  }
}
