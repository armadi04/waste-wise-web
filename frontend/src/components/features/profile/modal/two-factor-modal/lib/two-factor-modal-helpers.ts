import type { TwoFactorStep } from '@/hooks/profile'

export const COPY: Record<
  TwoFactorStep,
  { title: string; confirmLabel: string; danger?: boolean }
> = {
  setup: { title: 'Set up two-factor authentication', confirmLabel: 'Turn on' },
  codes: { title: 'Save your recovery codes', confirmLabel: 'Done' },
  disable: {
    title: 'Turn off two-factor authentication',
    confirmLabel: 'Turn off',
    danger: true,
  },
  regenerate: {
    title: 'Issue new recovery codes',
    confirmLabel: 'Replace codes',
  },
}
