import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { PortalCustomerPage } from '@/components/features/portal/pages/portal-customer'
import { loadAdminRoute } from '@/lib/query/loaders'
import { portalCustomerSearchSchema } from '@/lib/schemas/portal'

export const Route = createFileRoute('/(portal)/portal/customers/$customerId')({
  validateSearch: zodValidator(portalCustomerSearchSchema),
  loader: ({ context, params }) =>
    loadAdminRoute(
      context,
      '/portal/customers/$customerId',
      undefined,
      params.customerId,
    ),
  component: PortalCustomerPage,
})
