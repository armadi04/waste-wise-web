// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { addToast } from '@heroui/react'
import type { ReactNode } from 'react'
import { useMediaDeletion } from '@/hooks/media/use-media-deletion'
import { bulkDeleteMedia, deleteMedia } from '@/lib/services/media.service'

vi.mock('@heroui/react', () => ({ addToast: vi.fn() }))
vi.mock('@/lib/services/media.service', () => ({
  bulkDeleteMedia: vi.fn(),
  deleteMedia: vi.fn(),
}))

const setup = (onBulkSuccess = vi.fn()) => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  })
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useMediaDeletion(onBulkSuccess), { wrapper })
  return { ...hook, invalidate, onBulkSuccess }
}

describe('media deletion outcomes', () => {
  beforeEach(() => vi.clearAllMocks())
  it('reports partial outcomes instead of unconditional success and preserves per-item failures', async () => {
    const response: Awaited<ReturnType<typeof bulkDeleteMedia>> = {
      deleted: 1,
      queued: 1,
      failed: 1,
      results: [
        { id: 1, status: 'deleted' },
        { id: 2, status: 'queued' },
        { id: 3, status: 'failed', code: 'DELETE_FAILED' },
      ],
    }
    vi.mocked(bulkDeleteMedia).mockResolvedValue(response)
    const hook = setup()
    await act(async () => {
      await hook.result.current.bulkDeleteMutation.mutateAsync([1, 2, 3])
    })
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Some deletions failed',
        description: '1 deleted, 1 queued for cleanup, 1 failed.',
        color: 'danger',
      }),
    )
    expect(hook.onBulkSuccess).toHaveBeenCalledWith(response)
    for (const key of ['media', 'users', 'profile', 'stats'])
      expect(hook.invalidate).toHaveBeenCalledWith({ queryKey: [key] })
  })
  it('refreshes server state after an ambiguous transport failure', async () => {
    vi.mocked(bulkDeleteMedia).mockRejectedValue(
      new Error('Network disconnected'),
    )
    const hook = setup()
    await act(async () => {
      await expect(
        hook.result.current.bulkDeleteMutation.mutateAsync([1]),
      ).rejects.toThrow('Network disconnected')
    })
    expect(hook.onBulkSuccess).not.toHaveBeenCalled()
    expect(hook.invalidate).toHaveBeenCalledWith({ queryKey: ['media'] })
  })
  it('distinguishes queued cleanup from completed single deletion', async () => {
    vi.mocked(deleteMedia).mockResolvedValue({ id: 1, status: 'queued' })
    const hook = setup()
    await act(async () => {
      await hook.result.current.deleteMutation.mutateAsync(1)
    })
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Deletion scheduled',
        color: 'warning',
      }),
    )
  })
  it('does not present a failed single outcome as success', async () => {
    vi.mocked(deleteMedia).mockResolvedValue({
      id: 1,
      status: 'failed',
      code: 'DELETE_FAILED',
    })
    const hook = setup()
    await act(async () => {
      await hook.result.current.deleteMutation.mutateAsync(1)
    })
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Deletion failed', color: 'danger' }),
    )
  })
})
