import React from 'react'

/** A self-contained card of related settings rows. */
export function SettingsCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-large border border-default-200 bg-content1 p-6">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  )
}

export function SettingRow({
  label,
  description,
  action,
  children,
}: {
  label: string
  description: string
  action?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-default-700">{label}</p>
          <p className="text-xs text-default-400 mt-0.5">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
