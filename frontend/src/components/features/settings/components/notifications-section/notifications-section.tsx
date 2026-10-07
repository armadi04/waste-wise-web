import { Chip, Switch } from '@heroui/react'
import { AlertTriangle } from 'lucide-react'
import React from 'react'
import type { BrowserNotificationPermission } from '@/hooks/notifications'
import { useBrowserNotification } from '@/hooks/notifications'
import {
  SettingRow,
  SettingsCard,
} from '@/components/features/settings/components/settings-primitives'

const permissionChip: Record<BrowserNotificationPermission, React.ReactNode> = {
  granted: (
    <Chip size="sm" color="success" variant="flat">
      Allowed
    </Chip>
  ),
  denied: (
    <Chip size="sm" color="danger" variant="flat">
      Blocked
    </Chip>
  ),
  default: (
    <Chip size="sm" color="warning" variant="flat">
      Not set
    </Chip>
  ),
  unsupported: (
    <Chip size="sm" color="default" variant="flat">
      Not supported
    </Chip>
  ),
}

export function NotificationsSection() {
  const { permission, requestPermission } = useBrowserNotification()

  const isGranted = permission === 'granted'
  const isDenied = permission === 'denied'
  const isUnsupported = permission === 'unsupported'

  return (
    <SettingsCard title="Notifications">
      <SettingRow
        label="Browser Notifications"
        description="Allow the app to send native browser notifications"
        action={
          <div className="flex items-center gap-3 shrink-0">
            {permissionChip[permission]}
            <Switch
              isSelected={isGranted}
              onValueChange={(val) => {
                if (val) void requestPermission()
              }}
              isDisabled={isGranted || isDenied || isUnsupported}
              size="sm"
              color="primary"
            />
          </div>
        }
      >
        {isDenied && (
          <div className="flex items-start gap-2 mt-2 p-3 rounded-large bg-danger/5 border border-danger/10">
            <AlertTriangle size={14} className="text-danger shrink-0 mt-0.5" />
            <p className="text-xs text-danger">
              Notifications are blocked by your browser. To enable, click the
              lock icon in your address bar and allow notifications for this
              site.
            </p>
          </div>
        )}
      </SettingRow>
    </SettingsCard>
  )
}
