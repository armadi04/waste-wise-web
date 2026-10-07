export interface NavSection<TKey extends string> {
  key: TKey
  label: string
}

interface SectionNavLayoutProps<TKey extends string> {
  sections: ReadonlyArray<NavSection<TKey>>
  active: TKey
  onChange: (key: TKey) => void
  /** Skip the panel card when the section already renders cards of its own. */
  bare?: boolean
  children: React.ReactNode
}

/**
 * Settings-style shell: a list of sections on the left, the selected one in a
 * panel on the right. On narrow screens the list becomes a horizontal strip
 * above the panel rather than eating half the width.
 */
export function SectionNavLayout<TKey extends string>({
  sections,
  active,
  onChange,
  bare = false,
  children,
}: SectionNavLayoutProps<TKey>) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <nav
        aria-label="Sections"
        className="flex gap-1 overflow-x-auto rounded-large border border-default-200 bg-content1 p-2 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible"
      >
        {sections.map((section) => {
          const isActive = section.key === active
          return (
            <button
              key={section.key}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onChange(section.key)}
              className={`shrink-0 rounded-medium px-4 py-2.5 text-left text-xs font-bold tracking-widest uppercase transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-default-500 hover:bg-default-100'
              }`}
            >
              {section.label}
            </button>
          )
        })}
      </nav>

      <div
        className={
          bare
            ? 'min-w-0 flex-1'
            : 'min-w-0 flex-1 rounded-large border border-default-200 bg-content1 p-6'
        }
      >
        {children}
      </div>
    </div>
  )
}
