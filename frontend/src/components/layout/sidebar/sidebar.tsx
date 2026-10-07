import {
  Avatar,
  Divider,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  ScrollShadow,
} from '@heroui/react'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LogOut,
  Maximize,
  Minimize,
  Moon,
  MoreVertical,
  Sun,
  User,
} from 'lucide-react'
import { useState } from 'react'
import { Dropdown, DropdownItem } from '@/components/shared/controls'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useFullscreen, useSidebarLogic, useTheme } from '@/hooks/global'
import { SidebarItem } from '@/components/layout/sidebar/child/sidebar-item'

export {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
} from '@/lib/constants/sidebar'
export {
  useSidebar,
  useSidebarCollapsed,
  useSidebarWidth,
} from '@/lib/stores/sidebar.store'

export const Sidebar = () => {
  const {
    isCollapsed,
    profile,
    activeKey,
    expandedKeys,
    filteredSidebarData,
    handleToggle,
    handleSelect,
    sidebarWidth,
  } = useSidebarLogic()
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const { isFullscreen, toggleFullscreen } = useFullscreen()
  const { isDark, toggleTheme } = useTheme()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <motion.aside
      layout
      initial={false}
      animate={{ width: sidebarWidth }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="[view-transition-name:sidebar] fixed left-0 top-0 h-screen flex flex-col bg-transparent z-40"
    >
      <div
        className={`flex items-center ${isCollapsed ? 'justify-center' : 'px-4'} h-[80px] shrink-0`}
      >
        <AnimatePresence mode="wait">
          {isCollapsed ? (
            <motion.div
              key="collapsed-logo"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="whitespace-nowrap text-[24px] font-semibold tracking-tight italic"
            >
              <span className="text-[var(--app-link)]">K</span>
              <span className="text-foreground">M</span>
            </motion.div>
          ) : (
            <motion.div
              key="expanded-logo"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-0"
            >
              <div className="font-semibold text-2xl tracking-tight italic">
                <span className="text-[var(--app-link)]">Nest</span>
                <span className="text-foreground">plate</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Items */}
      <ScrollShadow
        className="flex-1 overflow-x-hidden"
        style={{ padding: isCollapsed ? '12px 8px' : '12px 16px' }}
      >
        {filteredSidebarData.map((group, idx) => (
          <div
            key={`${group.title}-${idx}`}
            className={idx !== 0 ? 'mt-6' : ''}
          >
            {!isCollapsed ? (
              <div className="px-2 mb-2 text-xs font-semibold text-default-400 uppercase tracking-wider truncate">
                {group.title}
              </div>
            ) : (
              idx !== 0 && <Divider className="my-4 bg-default-200/50" />
            )}

            <div className="space-y-1">
              {group.items.map((item) => (
                <SidebarItem
                  key={item.key}
                  item={item}
                  isCollapsed={isCollapsed}
                  activeKey={activeKey}
                  isExpanded={expandedKeys.has(item.key)}
                  onToggle={handleToggle}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>
        ))}
      </ScrollShadow>

      {/* Developer Credit */}
      {!isCollapsed && (
        <div className="flex justify-center pb-3 shrink-0">
          <a
            href="https://armadii.my.id"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-medium tracking-widest text-default-500 hover:text-default-500 transition-colors uppercase"
          >
            developer
          </a>
        </div>
      )}

      {/* User Footer — the whole row opens the account menu. */}
      <div className="p-3 border-t border-divider shrink-0">
        <Dropdown
          classNames={{ content: 'shadow-xl' }}
          placement={isCollapsed ? 'right-end' : 'top-end'}
          // Keep the row at full size while the menu is open; it reads as
          // disabled instead of shrinking.
          triggerScaleOnOpen={false}
          isOpen={isMenuOpen}
          onOpenChange={setIsMenuOpen}
        >
          <DropdownTrigger>
            <div
              className={`flex items-center gap-3 p-2 rounded-large transition-colors cursor-pointer ${
                isMenuOpen
                  ? 'bg-[var(--app-selected-background)]'
                  : 'hover:bg-default-100'
              } ${isCollapsed ? 'justify-center' : ''}`}
            >
              <Avatar
                src={profile?.avatar?.url || undefined}
                name={profile?.fullname?.charAt(0) || 'U'}
                size="sm"
                className="shrink-0"
              />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 min-w-0 overflow-hidden ml-1"
                  >
                    <p className="text-sm font-semibold text-foreground truncate">
                      {profile?.fullname || 'User'}
                    </p>
                    <p className="text-xs text-default-500 truncate">
                      {profile?.roles?.[0]?.name || 'Member'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {!isCollapsed && (
                <MoreVertical size={16} className="shrink-0 text-default-400" />
              )}
            </div>
          </DropdownTrigger>
          <DropdownMenu aria-label="Account actions" variant="flat">
            <DropdownSection showDivider>
              <DropdownItem
                key="profile"
                startContent={<User size={18} />}
                onPress={() => void navigate({ to: '/profile' })}
              >
                Profile
              </DropdownItem>
              <DropdownItem
                key="fullscreen"
                closeOnSelect={false}
                startContent={
                  isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />
                }
                onPress={() => void toggleFullscreen()}
              >
                {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              </DropdownItem>
              <DropdownItem
                key="theme"
                closeOnSelect={false}
                startContent={isDark ? <Sun size={18} /> : <Moon size={18} />}
                onPress={(e) => void toggleTheme(e.target)}
              >
                {isDark ? 'Light mode' : 'Dark mode'}
              </DropdownItem>
            </DropdownSection>
            <DropdownItem
              key="logout"
              color="danger"
              className="text-[var(--app-danger)]"
              startContent={<LogOut size={18} />}
              onPress={() => logout()}
            >
              Log Out
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </motion.aside>
  )
}
