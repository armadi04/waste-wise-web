import { heroui } from '@heroui/react'

/**
 * KuponMalam design system colors.
 *
 * The semantic values mirror DESIGN.md. The ramps preserve the existing
 * HeroUI shade utilities used throughout the app while keeping the default
 * values aligned with the design tokens.
 */
const primary = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#ca2222',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
  DEFAULT: '#ca2222',
  foreground: '#ffffff',
}

const primaryDark = {
  ...primary,
  DEFAULT: '#dc2626',
}

const secondary = {
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
  DEFAULT: '#e5e7eb',
  foreground: '#11181c',
}

const secondaryDark = {
  50: '#020617',
  100: '#0f172a',
  200: '#1e293b',
  300: '#334155',
  400: '#475569',
  500: '#64748b',
  600: '#94a3b8',
  700: '#cbd5e1',
  800: '#e2e8f0',
  900: '#f8fafc',
  DEFAULT: '#0f172a',
  foreground: '#ecedee',
}

const neutral = {
  50: '#fafafa',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#6a7282',
  500: '#6a7282',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#11181c',
  DEFAULT: '#e5e7eb',
  foreground: '#11181c',
}

const neutralDark = {
  50: '#18181b',
  100: '#262626',
  200: '#27272a',
  300: '#3f3f46',
  400: '#a1a1aa',
  500: '#a1a1aa',
  600: '#d4d4d8',
  700: '#e4e4e7',
  800: '#ecedee',
  900: '#fafafa',
  DEFAULT: '#27272a',
  foreground: '#ecedee',
}

const success = {
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
  DEFAULT: '#16a34a',
  foreground: '#ffffff',
}

const warning = {
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
  DEFAULT: '#fbbf24',
  foreground: '#11181c',
}

const danger = {
  50: '#fee7ef',
  100: '#fdd0df',
  200: '#faa0bf',
  300: '#f871a0',
  400: '#f54180',
  500: '#f31260',
  600: '#c20e4d',
  700: '#920b3a',
  800: '#610726',
  900: '#310413',
  DEFAULT: '#f31260',
  foreground: '#ffffff',
}

export default heroui({
  themes: {
    light: {
      colors: {
        background: '#ffffff',
        foreground: '#11181c',
        divider: '#e5e7eb',
        overlay: '#ffffff',
        content1: { DEFAULT: '#ffffff', foreground: '#11181c' },
        content2: { DEFAULT: '#f3f4f6', foreground: '#11181c' },
        content3: { DEFAULT: '#e5e7eb', foreground: '#11181c' },
        content4: { DEFAULT: '#d1d5db', foreground: '#11181c' },
        primary,
        secondary,
        success,
        warning,
        danger,
        default: neutral,
        focus: '#155dfc',
      },
    },
    dark: {
      colors: {
        background: '#000000',
        foreground: '#ecedee',
        divider: '#27272a',
        overlay: '#0f172a',
        content1: { DEFAULT: '#0f172a', foreground: '#ecedee' },
        content2: { DEFAULT: '#262626', foreground: '#ecedee' },
        content3: { DEFAULT: '#27272a', foreground: '#ecedee' },
        content4: { DEFAULT: '#3f3f46', foreground: '#ecedee' },
        primary: primaryDark,
        secondary: secondaryDark,
        success,
        warning,
        danger,
        default: neutralDark,
        focus: '#155dfc',
      },
    },
  },
  layout: {
    radius: {
      small: '10px',
      medium: '12px',
      large: '16px',
    },
  },
})
