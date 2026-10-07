import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { NavItem } from '@/lib/constants/sidebar'
import { Button } from '@/components/shared/controls'

export const MobileNavItem = ({
  item,
  activeKey,
  badgeCount = 0,
  onSelect,
}: {
  item: NavItem
  activeKey: string | null
  badgeCount?: number
  onSelect: (key: string, href?: string) => void
}) => {
  const isActive =
    activeKey === item.key ||
    Boolean(item.children?.some((child) => child.key === activeKey))
  const hasChildren = item.children && item.children.length > 0
  const [isExpanded, setIsExpanded] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const submenuId = `mobile-nav-${item.key}`

  const handlePress = () => {
    if (hasChildren) {
      setIsExpanded((expanded) => !expanded)
    } else {
      onSelect(item.key, item.href)
    }
  }

  return (
    <div className="flex flex-col">
      <Button
        variant="light"
        onPress={handlePress}
        aria-label={item.label}
        aria-current={isActive && !hasChildren ? 'page' : undefined}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-controls={hasChildren ? submenuId : undefined}
        className={`w-full justify-start gap-4 rounded-large px-4 py-3 text-left transition-all focus-visible:ring-2 focus-visible:ring-focus ${
          isActive
            ? 'app-selected font-medium'
            : 'text-default-600 hover:bg-default-100'
        }`}
      >
        <span
          className={`shrink-0 ${isActive ? 'text-[var(--app-selected-foreground)]' : 'text-default-500'}`}
        >
          {item.icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-base">{item.label}</span>
        {badgeCount > 0 && (
          <span className="shrink-0 rounded-full bg-danger px-2 py-0.5 text-[11px] font-semibold leading-none text-danger-foreground">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
        {hasChildren && (
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            className="shrink-0 text-default-400"
          >
            <ChevronRight size={18} />
          </motion.div>
        )}
      </Button>

      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            id={submenuId}
            className="overflow-hidden pl-12 flex flex-col gap-1 mt-1"
          >
            {item.children?.map((child) => (
              <Button
                key={child.key}
                variant="light"
                onPress={() => onSelect(child.key, child.href)}
                aria-label={child.label}
                aria-current={activeKey === child.key ? 'page' : undefined}
                className={`w-full justify-start rounded-large px-4 py-2.5 text-left text-sm transition-all focus-visible:ring-2 focus-visible:ring-focus ${
                  activeKey === child.key
                    ? 'app-selected font-medium'
                    : 'text-default-500 hover:bg-default-100 hover:text-default-900'
                }`}
              >
                {child.label}
              </Button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
