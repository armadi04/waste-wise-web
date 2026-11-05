import type { ReactNode } from 'react'

export function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any
  label: string
  value?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-large bg-default-50 border border-default-100">
      <Icon size={16} className="text-[var(--app-link)] shrink-0" />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-semibold text-default-500 uppercase tracking-widest leading-none">
          {label}
        </span>
        <span className="text-sm font-medium text-default-700">
          {value === undefined || value === null || value === '' ? 'N/A' : value}
        </span>
      </div>
    </div>
  )
}
