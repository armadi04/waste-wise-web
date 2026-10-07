import { Button, Chip, addToast } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { RefreshCw, Sparkles } from 'lucide-react'
import {
  SettingRow,
  SettingsCard,
} from '@/components/features/settings/components/settings-primitives'
import { useChangelog } from '@/hooks/changelog'
import { usePwaUpdate } from '@/hooks/global/use-pwa-update'

export function UpdateSection() {
  const {
    updateAvailable,
    isChecking,
    isUpdating,
    checkForUpdate,
    applyUpdate,
  } = usePwaUpdate()
  const { version } = useChangelog()

  const handleCheck = async () => {
    const result = await checkForUpdate()
    if (result === 'found') {
      addToast({ title: 'A new version is available', color: 'warning' })
    } else if (result === 'none') {
      addToast({ title: "You're on the latest version", color: 'success' })
    } else {
      addToast({
        title: 'Check unavailable',
        description:
          'No service worker is active yet (e.g. in development). Try the installed app.',
        color: 'default',
      })
    }
  }

  return (
    <SettingsCard title="Updates">
      <SettingRow
        label={version ? `App Version — ${version}` : 'App Version'}
        description={
          updateAvailable
            ? 'A new version is ready. Update to get the latest features and fixes.'
            : 'Check whether a newer version of Kupon Malam is available.'
        }
        action={
          updateAvailable ? (
            <Button
              size="sm"
              color="primary"
              variant="flat"
              onPress={applyUpdate}
              isLoading={isUpdating}
              startContent={!isUpdating && <Sparkles size={14} />}
              className="font-medium shrink-0"
            >
              Update Now
            </Button>
          ) : (
            <Button
              size="sm"
              variant="flat"
              onPress={handleCheck}
              isLoading={isChecking}
              startContent={!isChecking && <RefreshCw size={14} />}
              className="font-medium shrink-0"
            >
              Check for Updates
            </Button>
          )
        }
      >
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {updateAvailable && (
            <Chip size="sm" color="warning" variant="flat">
              Update available
            </Chip>
          )}
          <Link
            to="/changelog"
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            View the changelog
          </Link>
        </div>
      </SettingRow>
    </SettingsCard>
  )
}
