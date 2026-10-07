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

/**
 * Publishes the page title + breadcrumb trail to the top bar (rendered there
 * on the left). Renders only the page-level actions / description / children
 * inline — the title band itself now lives in the Header.
 */
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

  const hasInline = Boolean(actions || description || leading || children)
  if (!hasInline) return null

  return (
    <div className="mb-6">
      {(actions || description || leading) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {leading ? (
            <div className="flex shrink-0 items-center">{leading}</div>
          ) : description ? (
            <p className="max-w-2xl text-sm text-default-500">{description}</p>
          ) : (
            <span />
          )}
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
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
