import type { QueryClient } from '@tanstack/react-query'

let client: QueryClient | undefined
export function bindAuthQueryClient(queryClient: QueryClient) {
  client = queryClient
}
export function clearAuthQueryCache() {
  void client?.cancelQueries()
  client?.clear()
}
