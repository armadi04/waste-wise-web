import { useEffect } from 'react'
import { usePageHeaderStore } from '@/lib/stores/page-header.store'

interface Breadcrumb {
  label: string
  href?: string
  isCurrent?: boolean
}

interface PageHeaderProps {
  title: string
  /** Optional supporting line rendered above the content. */
  description?: string
  /** Optional node rendered at the far left of the toolbar row (e.g. a back button). */
  leading?: React.ReactNode
  /** Let the actions row span the full width (so an inner element can flex-grow). */
  fullWidthActions?: boolean
  breadcrumbs?: Array<Breadcrumb>
  actions?: React.ReactNode
  children?: React.ReactNode
}

/** Owns the page title, description, and actions; publishes breadcrumbs to the top bar. */
export function PageHeader({
  title,
  description,
  leading,
  fullWidthActions = false,
  breadcrumbs = [],
  actions,
  children,
}: PageHeaderProps) {
  const setHeader = usePageHeaderStore((s) => s.setHeader)
  const clear = usePageHeaderStore((s) => s.clear)

  // Stringify breadcrumbs so a fresh array literal each render doesn't refire.
  const crumbsKey = JSON.stringify(breadcrumbs)
  useEffect(() => {
    setHeader(title, JSON.parse(crumbsKey) as Array<Breadcrumb>)
    return () => clear()
  }, [title, crumbsKey, setHeader, clear])

  return (
    <div className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {leading && <div className="shrink-0">{leading}</div>}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {description && (
              <p className="mt-1 max-w-2xl text-sm text-default-500">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div
            className={
              fullWidthActions
                ? 'flex min-w-0 flex-1 items-center gap-2'
                : 'flex shrink-0 flex-wrap items-center gap-2 sm:justify-end'
            }
          >
            {actions}
          </div>
        )}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
