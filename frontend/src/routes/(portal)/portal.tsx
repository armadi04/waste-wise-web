import { createFileRoute } from '@tanstack/react-router'
import { PortalLayout } from '@/components/features/portal/pages/portal-layout'
import { requireAuth } from '@/lib/utils/route-guard'

export const Route = createFileRoute('/(portal)/portal')({
  beforeLoad: requireAuth,
  component: PortalLayout,
})
