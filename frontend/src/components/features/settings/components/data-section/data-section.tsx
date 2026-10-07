import { Button } from '@heroui/react'
import { Trash2 } from 'lucide-react'
import {
  SettingRow,
  SettingsCard,
} from '@/components/features/settings/components/settings-primitives'
import { useClearCache } from '@/hooks/global'

export function DataSection() {
  const { clearAll, isClearing } = useClearCache()

  return (
    <SettingsCard title="Data & Storage">
      <SettingRow
        label="Clear App Data"
        description="Wipes all cached data, cookies, and local storage. You will be logged out."
        action={
          <Button
            size="sm"
            variant="flat"
            color="danger"
            onPress={clearAll}
            isLoading={isClearing}
            startContent={!isClearing && <Trash2 size={14} />}
            className="font-medium shrink-0"
          >
            Clear All
          </Button>
        }
      />
    </SettingsCard>
  )
}
