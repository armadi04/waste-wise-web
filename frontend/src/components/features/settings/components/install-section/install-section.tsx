import { Button, Chip } from '@heroui/react'
import { Download, MonitorSmartphone } from 'lucide-react'
import {
  SettingRow,
  SettingsCard,
} from '@/components/features/settings/components/settings-primitives'
import { usePwaInstall } from '@/hooks/global'

export function InstallSection() {
  const { isInstallable, isInstalled, install } = usePwaInstall()

  if (!isInstallable && !isInstalled) return null

  return (
    <SettingsCard title="App">
      <SettingRow
        label="Install App"
        description={
          isInstalled
            ? 'Nestplate is installed and running as a native app on this device'
            : 'Add Nestplate to your home screen for a faster, native-like experience'
        }
        action={
          isInstalled ? (
            <Chip
              size="sm"
              color="success"
              variant="flat"
              startContent={<MonitorSmartphone size={12} />}
            >
              Installed
            </Chip>
          ) : (
            <Button
              size="sm"
              color="primary"
              variant="flat"
              onPress={install}
              startContent={<Download size={14} />}
              className="font-medium shrink-0"
            >
              Install
            </Button>
          )
        }
      />
    </SettingsCard>
  )
}
