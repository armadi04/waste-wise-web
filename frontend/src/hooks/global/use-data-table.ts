import type { SortDescriptor } from '@heroui/react'

export function useDataTable(routeApi: any) {
  const navigate = routeApi.useNavigate()
  const searchParams = routeApi.useSearch()

  const page = searchParams.page || 1
  const perPage = searchParams.limit || 20
  const search = searchParams.search || ''
  const sortDescriptor: SortDescriptor = {
    column: searchParams.sort || 'createdAt',
    direction: searchParams.direction === 'asc' ? 'ascending' : 'descending',
  }

  const onSearch = (value: string) =>
    navigate({ search: (prev: any) => ({ ...prev, search: value, page: 1 }) })

  const onSortChange = (descriptor: SortDescriptor) =>
    navigate({
      search: (prev: any) => ({
        ...prev,
        sort: descriptor.column,
        direction: descriptor.direction === 'ascending' ? 'asc' : 'desc',
      }),
    })

  const onPageChange = (page: number) =>
    navigate({ search: (prev: any) => ({ ...prev, page }) })

  const onLimitChange = (limit: number) =>
    navigate({ search: (prev: any) => ({ ...prev, limit, page: 1 }) })

  return {
    page,
    limit: perPage,
    search,
    sortDescriptor,
    onSearch,
    onSortChange,
    onPageChange,
    onLimitChange,
  }
}
