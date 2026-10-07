import { TanStackDevtools } from '@tanstack/react-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'

const TANSTACK_DEVTOOLS_SETTINGS_KEY = 'tanstack_devtools_settings'

// TanStack Devtools lets persisted settings override the component config. Keep
// existing development sessions from restoring the old floating position.
function migrateDevtoolsTriggerPosition() {
  if (typeof window === 'undefined') return

  try {
    const storedSettings = window.localStorage.getItem(
      TANSTACK_DEVTOOLS_SETTINGS_KEY,
    )
    if (!storedSettings) return

    const settings = JSON.parse(storedSettings) as Record<string, unknown>
    if (
      settings.triggerMode === 'fixed' &&
      settings.position === 'bottom-right'
    ) {
      return
    }

    window.localStorage.setItem(
      TANSTACK_DEVTOOLS_SETTINGS_KEY,
      JSON.stringify({
        ...settings,
        triggerMode: 'fixed',
        position: 'bottom-right',
      }),
    )
  } catch {
    // Ignore unavailable or malformed local storage in development.
  }
}

// Dev-only. Imported lazily from `__root.tsx` behind `import.meta.env.DEV` so the
// devtools packages are dropped from the production bundle entirely.
export default function Devtools() {
  migrateDevtoolsTriggerPosition()

  return (
    <TanStackDevtools
      config={{ position: 'bottom-right', triggerMode: 'fixed' }}
      plugins={[
        { name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> },
        { name: 'Tanstack Query', render: <ReactQueryDevtoolsPanel /> },
      ]}
    />
  )
}
