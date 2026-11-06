import type { ReactNode } from 'react'

interface FilterFieldProps {
  label: string
  children: ReactNode
  className?: string
}

/**
 * Compact filter control: small label above a full-width field. Used for native
 * select/date filters so they line up in a grid on mobile and wrap cleanly on
 * desktop. The wrapped control should use the `app-field-control` class.
 */
export function FilterField({ label, children, className }: FilterFieldProps) {
  return (
    <label
      className={`flex min-w-0 flex-col gap-1 text-sm lg:min-w-36 ${className ?? ''}`}
    >
      <span className="text-xs font-medium text-default-500">{label}</span>
      {children}
    </label>
  )
}
