import { addToast } from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import type { MediaBulkDeleteResult } from '@/lib/services/media.service'
import { useAppMutation } from '@/hooks/global/use-mutations'
import { bulkDeleteMedia, deleteMedia } from '@/lib/services/media.service'

export function useMediaDeletion(
  onBulkSuccess: (result: MediaBulkDeleteResult) => void,
) {
  const queryClient = useQueryClient()
  const refresh = async () => {
    await Promise.all(
      ['media', 'users', 'profile', 'stats'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    )
  }
  const deleteMutation = useAppMutation({
    mutationFn: deleteMedia,
    onSettled: refresh,
    onSuccess: (result) => {
      const failed = result.status === 'failed'
      addToast({
        title: failed
          ? 'Deletion failed'
          : result.status === 'queued'
            ? 'Deletion scheduled'
            : 'Media deleted',
        description: failed
          ? 'File could not be scheduled for deletion.'
          : result.status === 'queued'
            ? 'Remote cleanup will retry automatically.'
            : 'File removed from the media library.',
        color: failed
          ? 'danger'
          : result.status === 'queued'
            ? 'warning'
            : 'primary',
      })
    },
  })
  const bulkDeleteMutation = useAppMutation({
    mutationFn: bulkDeleteMedia,
    onSettled: refresh,
    onSuccess: (result) => {
      addToast({
        title: result.failed
          ? 'Some deletions failed'
          : result.queued
            ? 'Deletion scheduled'
            : 'Media deleted',
        description: `${result.deleted} deleted, ${result.queued} queued for cleanup, ${result.failed} failed.`,
        color: result.failed ? 'danger' : result.queued ? 'warning' : 'primary',
      })
      onBulkSuccess(result)
    },
  })
  return { deleteMutation, bulkDeleteMutation }
}
