import { heroui } from '@heroui/react'

// Complete HeroUI ramps; operational pairs live in application variants.
const blue = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
}

const slate = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
}

const green = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
}

const amber = {
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
}

const red = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
}

export default heroui({
  themes: {
    light: {
      colors: {
        background: '#f8fafc',
        foreground: '#0f172a',
        divider: '#e2e8f0',
        focus: '#2563eb',
        overlay: '#ffffff',
        content1: { DEFAULT: '#ffffff', foreground: '#0f172a' },
        content2: { DEFAULT: '#f1f5f9', foreground: '#0f172a' },
        content3: { DEFAULT: '#f1f5f9', foreground: '#0f172a' },
        content4: { DEFAULT: '#e2e8f0', foreground: '#0f172a' },
        default: {
          ...slate,
          400: '#475569',
          500: '#475569',
          DEFAULT: '#f1f5f9',
          foreground: '#0f172a',
        },
        primary: { ...blue, DEFAULT: '#2563eb', foreground: '#ffffff' },
        secondary: { ...blue, DEFAULT: '#2563eb', foreground: '#ffffff' },
        success: { ...green, DEFAULT: '#15803d', foreground: '#ffffff' },
        warning: { ...amber, DEFAULT: '#b45309', foreground: '#ffffff' },
        danger: { ...red, DEFAULT: '#b91c1c', foreground: '#ffffff' },
      },
    },
    dark: {
      colors: {
        background: '#0f172a',
        foreground: '#f8fafc',
        divider: '#334155',
        focus: '#93c5fd',
        overlay: '#1e293b',
        content1: { DEFAULT: '#1e293b', foreground: '#f8fafc' },
        content2: { DEFAULT: '#334155', foreground: '#f8fafc' },
        content3: { DEFAULT: '#334155', foreground: '#f8fafc' },
        content4: { DEFAULT: '#475569', foreground: '#f8fafc' },
        default: {
          ...slate,
          50: '#0f172a',
          100: '#334155',
          200: '#334155',
          300: '#475569',
          400: '#cbd5e1',
          500: '#cbd5e1',
          600: '#e2e8f0',
          700: '#f1f5f9',
          800: '#f8fafc',
          900: '#f8fafc',
          DEFAULT: '#334155',
          foreground: '#f8fafc',
        },
        primary: { ...blue, DEFAULT: '#2563eb', foreground: '#ffffff' },
        secondary: { ...blue, DEFAULT: '#2563eb', foreground: '#ffffff' },
        success: { ...green, DEFAULT: '#15803d', foreground: '#ffffff' },
        warning: { ...amber, DEFAULT: '#b45309', foreground: '#ffffff' },
        danger: { ...red, DEFAULT: '#b91c1c', foreground: '#ffffff' },
      },
    },
  },
  layout: { radius: { small: '10px', medium: '12px', large: '16px' } },
})
