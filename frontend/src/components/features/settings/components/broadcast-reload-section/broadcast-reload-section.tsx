import { RadioTower } from 'lucide-react'
import { Button } from '@/components/shared/controls'
import {
  SettingRow,
  SettingsCard,
} from '@/components/features/settings/components/settings-primitives'
import { useAppMutation, useConfirmation } from '@/hooks/global'
import { useUserPermission } from '@/hooks/permissions'
import { forceClientRefresh } from '@/lib/services/app.service'

/**
 * Reloads every connected client. It acts on other people rather than this
 * browser, so it stands apart from the personal settings above it and is hidden
 * entirely without `app.force_refresh`.
 */
export function BroadcastReloadSection() {
  const { confirm } = useConfirmation()
  const { hasPermission } = useUserPermission()

  const broadcastMutation = useAppMutation({
    mutationFn: forceClientRefresh,
    successMessage: 'Every client will reload onto the latest version',
  })

  const handleBroadcast = async () => {
    const confirmed = await confirm({
      title: 'Reload Every Client',
      message:
        'Everyone using the app right now will have their cache cleared and the page reloaded — including you. Anything unsaved is lost. Use this after a deploy that clients are not picking up.',
      color: 'warning',
    })
    if (!confirmed) return
    broadcastMutation.mutate(undefined)
  }

  if (!hasPermission('app.force_refresh')) return null

  return (
    <SettingsCard title="Administration">
      <SettingRow
        label="Reload Every Client"
        description="Clear the cache and reload for everyone using the app, so nobody stays on a stale build after a deploy."
        action={
          <Button
            size="sm"
            variant="flat"
            color="danger"
            onPress={handleBroadcast}
            isLoading={broadcastMutation.isPending}
            startContent={
              !broadcastMutation.isPending && <RadioTower size={14} />
            }
            className="shrink-0 font-medium"
          >
            Reload All
          </Button>
        }
      />
    </SettingsCard>
  )
}
