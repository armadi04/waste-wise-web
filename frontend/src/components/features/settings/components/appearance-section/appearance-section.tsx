import { CheckCircle2, Moon, Sun } from 'lucide-react'
import { Divider } from '@heroui/react'
import type { CSSProperties } from 'react'
import type { BackgroundStyle } from '@/hooks/global'
import {
  SettingRow,
  SettingsCard,
} from '@/components/features/settings/components/settings-primitives'
import { useBackground } from '@/hooks/global'
import { useThemeStore } from '@/lib/stores/theme.store'

const GRADIENT_PREVIEW =
  'linear-gradient(to bottom right, rgba(121, 58, 255, 0.35), rgba(45, 212, 191, 0.25), rgba(28, 139, 242, 0.3))'

const backgroundOptions: Array<{
  value: BackgroundStyle
  label: string
  description: string
  preview: CSSProperties
}> = [
  {
    value: 'gradient',
    label: 'Gradient',
    description: 'Soft colorful ambient',
    preview: { background: GRADIENT_PREVIEW },
  },
  {
    value: 'gray',
    label: 'Gray',
    description: 'Soft warm gray',
    preview: { background: '#f5f5f7' },
  },
  {
    value: 'neutral',
    label: 'Neutral',
    description: 'Pure white',
    preview: { background: '#ffffff' },
  },
]

/** Theme and background choices — persisted via their respective stores. */
export function AppearanceSection() {
  const isDark = useThemeStore((s) => s.isDark)
  const setTheme = useThemeStore((s) => s.setTheme)
  const { style, setBackground } = useBackground()

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

      {!isDark && (
        <>
          <Divider />
          <SettingRow
            label="Background"
            description="Choose the app background style"
          >
            <div className="mt-3 grid grid-cols-3 gap-3 md:grid-cols-6">
              {backgroundOptions.map((option) => {
                const selected = style === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBackground(option.value)}
                    aria-pressed={selected}
                    className={`flex cursor-pointer flex-col gap-2 rounded-2xl border-2 p-3 text-left transition-all duration-150 ${
                      selected
                        ? 'border-primary bg-primary/5'
                        : 'border-default-200 bg-content1 hover:border-default-400'
                    }`}
                  >
                    <div
                      className="h-16 w-full rounded-xl border border-default-100 bg-default-100"
                      style={option.preview}
                    />
                    <div className="flex items-start justify-between gap-1 px-0.5">
                      <div>
                        <p
                          className={`text-xs font-semibold ${
                            selected ? 'text-primary' : 'text-default-700'
                          }`}
                        >
                          {option.label}
                        </p>
                        <p className="mt-0.5 text-[10px] leading-tight text-default-400">
                          {option.description}
                        </p>
                      </div>
                      {selected && (
                        <CheckCircle2
                          size={14}
                          className="mt-0.5 shrink-0 text-primary"
                        />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </SettingRow>
        </>
      )}
    </SettingsCard>
  )
}
