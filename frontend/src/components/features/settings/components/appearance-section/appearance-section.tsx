import { Moon, Sun } from 'lucide-react'
import {
  SettingRow,
  SettingsCard,
} from '@/components/features/settings/components/settings-primitives'
import { useThemeStore } from '@/lib/stores/theme.store'

/** Theme choice — the only persisted appearance setting; mirrors `theme.store`. */
export function AppearanceSection() {
  const isDark = useThemeStore((s) => s.isDark)
  const setTheme = useThemeStore((s) => s.setTheme)

  const options = [
    {
      key: 'light',
      label: 'Light',
      icon: Sun,
      active: !isDark,
      on: () => setTheme(false),
    },
    {
      key: 'dark',
      label: 'Dark',
      icon: Moon,
      active: isDark,
      on: () => setTheme(true),
    },
  ]

  return (
    <SettingsCard title="Appearance">
      <SettingRow
        label="Theme"
        description="Light or dark interface"
        action={
          <div className="flex shrink-0 gap-1 rounded-medium border border-default-200 p-1">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={o.on}
                aria-pressed={o.active}
                className={`flex items-center gap-1.5 rounded-small px-3 py-1.5 text-sm font-medium transition-colors ${
                  o.active
                    ? 'app-selected'
                    : 'text-default-500 hover:bg-default-100'
                }`}
              >
                <o.icon size={15} />
                {o.label}
              </button>
            ))}
          </div>
        }
      />
    </SettingsCard>
  )
}
