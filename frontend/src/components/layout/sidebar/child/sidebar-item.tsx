import { PopoverContent, PopoverTrigger } from '@heroui/react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import type { NavItem } from '@/lib/constants/sidebar'
import { NAV_ACTIVE_CLASSES, NAV_IDLE_CLASSES } from '@/lib/constants/nav'
import { Popover, Tooltip } from '@/components/shared/controls'

export const SidebarItem = ({
  item,
  isCollapsed,
  activeKey,
  isExpanded,
  onToggle,
  onSelect,
}: {
  item: NavItem
  isCollapsed: boolean
  activeKey: string | null
  isExpanded: boolean
  onToggle: (key: string) => void
  onSelect: (key: string, href?: string) => void
}) => {
  const reducedMotion = useReducedMotion()
  const isActive = activeKey === item.key
  const hasChildren = item.children && item.children.length > 0

  const handlePress = () => {
    if (hasChildren) {
      onToggle(item.key)
    } else {
      onSelect(item.key, item.href)
    }
  }

  const buttonClasses = `
    relative flex items-center rounded-lg cursor-pointer transition-all duration-200
    ${isActive ? NAV_ACTIVE_CLASSES : NAV_IDLE_CLASSES}
    ${isCollapsed ? 'size-11 shrink-0 justify-center px-0' : 'w-full min-h-[40px] h-10 gap-3 px-3'}
  `

  const ButtonContent = (
    <button
      type="button"
      aria-current={isActive && !hasChildren ? 'page' : undefined}
      aria-expanded={hasChildren ? isExpanded : undefined}
      className={buttonClasses}
      onClick={handlePress}
    >
      <span className="shrink-0 transition-colors [&>svg]:stroke-2">
        {item.icon}
      </span>

      {!isCollapsed && (
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          className="flex-1 text-left truncate text-sm ml-1"
        >
          {item.label}
        </motion.div>
      )}

      {!isCollapsed && hasChildren && (
        <motion.span
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          className="text-default-500"
        >
          <ChevronRight size={16} />
        </motion.span>
      )}
    </button>
  )

  // Collapsed state with children - show popover
  if (isCollapsed) {
    if (hasChildren) {
      return (
        <Popover
          classNames={{ content: 'shadow-xl' }}
          placement="right-start"
          offset={10}
        >
          <PopoverTrigger>
            <div className="mb-1 w-full flex justify-center">
              {ButtonContent}
            </div>
          </PopoverTrigger>
          <PopoverContent className="p-2 min-w-[180px]">
            <div className="w-full flex flex-col gap-1">
              <p className="text-xs font-semibold text-default-500 px-2 py-1 mb-1">
                {item.label}
              </p>
              {item.children?.map((child) => (
                <button
                  key={child.key}
                  onClick={() => onSelect(child.key, child.href)}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-sm ${
                    activeKey === child.key
                      ? NAV_ACTIVE_CLASSES
                      : NAV_IDLE_CLASSES
                  }`}
                >
                  <span className="shrink-0 [&>svg]:stroke-2">
                    {child.icon}
                  </span>
                  <span>{child.label}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )
    } else {
      // Collapsed without children - show tooltip
      return (
        <div className="mb-1">
          <Tooltip
            content={item.label}
            placement="right"
            offset={10}
            closeDelay={0}
          >
            <div className="w-full flex justify-center">{ButtonContent}</div>
          </Tooltip>
        </div>
      )
    }
  }

  // Expanded state
  return (
    <div className="mb-1">
      {ButtonContent}
      <AnimatePresence>
        {hasChildren && isExpanded && !isCollapsed && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pl-9 space-y-1 mt-1">
              {item.children?.map((child) => (
                <SidebarItem
                  key={child.key}
                  item={child}
                  isCollapsed={isCollapsed}
                  activeKey={activeKey}
                  isExpanded={false}
                  onToggle={() => {}}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
