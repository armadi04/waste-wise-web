import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { SavePortalContentInput } from '@/lib/services/portal.service'
import { useAppMutation } from '@/hooks/global/use-mutations'
import { useUserPermission } from '@/hooks/permissions/use-permissions'
import { portalContentQueryOptions } from '@/lib/query/options'
import { savePortalContent } from '@/lib/services/portal.service'

const routeApi = getRouteApi('/(portal)/portal/content')

export const usePortalContentPage = () => {
  const { key } = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const { hasPermission } = useUserPermission()
  const canRead = hasPermission('portal.content.read')
  const canUpdate = hasPermission('portal.content.update')
  const query = useQuery(portalContentQueryOptions(canRead))
  const entries = query.data ?? []
  const selected = entries.find((entry) => entry.key === key) ?? entries.at(0)
  const save = useAppMutation({
    mutationFn: ({
      key: contentKey,
      data,
    }: {
      key: string
      data: SavePortalContentInput
    }) => savePortalContent(contentKey, data),
    invalidateKeys: [['portal', 'content']],
    successMessage: 'Content saved',
  })
  return {
    canRead,
    canUpdate,
    query,
    entries,
    selected,
    save,
    onSelect: (next: string) => {
      void navigate({ search: { key: next }, replace: true })
    },
  }
}
