import {
  Badge,
  Divider,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  ScrollShadow,
  useDisclosure,
} from '@heroui/react'
import { MoreHorizontal } from 'lucide-react'
import { Button, Drawer } from '@/components/shared/controls'
import {
  BAR_KEYS,
  MOBILE_LABELS,
} from '@/components/layout/bottom-nav/lib/bottom-nav-helpers'
import { useSidebarLogic } from '@/hooks/global'
import { useUnreadCount } from '@/hooks/notifications'
import { NAV_ACTIVE_CLASSES, NAV_IDLE_CLASSES } from '@/lib/constants/nav'

import { MobileNavItem } from '@/components/layout/bottom-nav/child/mobile-nav-item'

export const BottomNav = () => {
  const { activeKey, filteredSidebarData, handleSelect } = useSidebarLogic()
  const { data: unreadCount = 0 } = useUnreadCount()

  const { isOpen, onOpen, onOpenChange } = useDisclosure()

  // Flatten all items for easier access.
  const allItems = filteredSidebarData.flatMap((group) => group.items)

  const topItems = BAR_KEYS.map((key) =>
    allItems.find((item) => item.key === key),
  ).filter((item): item is NonNullable<typeof item> => Boolean(item))
  const topItemKeys = new Set(topItems.map((item) => item.key))
  const isMoreActive = activeKey !== null && !topItemKeys.has(activeKey)
  const normalizedUnreadCount =
    typeof unreadCount === 'number' && unreadCount > 0 ? unreadCount : 0
  const unreadLabel = normalizedUnreadCount > 99 ? '99+' : normalizedUnreadCount

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="[view-transition-name:bottom-nav] mobile-bottom-nav lg:hidden"
      >
        <div className="mobile-bottom-nav__items">
          {topItems.map((item) => {
            const isActive = activeKey === item.key
            return (
              <Button
                key={item.key}
                variant="light"
                aria-label={MOBILE_LABELS[item.key] ?? item.label}
                aria-current={isActive ? 'page' : undefined}
                onPress={() => handleSelect(item.key, item.href)}
                className={`mobile-bottom-nav__item h-14 min-w-0 rounded-full px-1 transition-colors ${
                  isActive ? NAV_ACTIVE_CLASSES : NAV_IDLE_CLASSES
                }`}
              >
                <span className="flex min-w-0 flex-col items-center justify-center gap-1 leading-none">
                  <span className="mobile-bottom-nav__icon flex h-6 items-center justify-center">
                    {item.icon}
                  </span>
                  <span className="mobile-bottom-nav__label max-w-full truncate text-[11px]">
                    {MOBILE_LABELS[item.key] ?? item.label}
                  </span>
                </span>
              </Button>
            )
          })}

          <Button
            variant="light"
            aria-label={
              normalizedUnreadCount > 0
                ? `More menus, ${unreadLabel} unread notifications`
                : 'More menus'
            }
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            onPress={onOpen}
            aria-current={isMoreActive ? 'page' : undefined}
            className={`mobile-bottom-nav__item h-14 min-w-0 overflow-visible rounded-full px-1 transition-colors ${
              isMoreActive ? NAV_ACTIVE_CLASSES : NAV_IDLE_CLASSES
            }`}
          >
            <span className="flex min-w-0 flex-col items-center justify-center gap-1 leading-none">
              <span className="mobile-bottom-nav__icon flex h-6 items-center justify-center">
                <Badge
                  color="danger"
                  content={unreadLabel}
                  isInvisible={normalizedUnreadCount === 0}
                  placement="top-right"
                  shape="circle"
                  size="sm"
                  classNames={{ badge: 'border-2 border-background' }}
                >
                  <MoreHorizontal size={22} />
                </Badge>
              </span>
              <span className="mobile-bottom-nav__label text-[11px]">More</span>
            </span>
          </Button>
        </div>
      </nav>

      <Drawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement="bottom"
        size="2xl"
        classNames={{
          base: 'rounded-t-[32px] bg-background/95 backdrop-blur-md',
          header: 'border-b border-divider/50',
          closeButton: 'top-4 right-4',
        }}
      >
        <DrawerContent>
          {(onClose) => (
            <>
              <DrawerHeader className="flex flex-col gap-1 items-center pb-2">
                <div className="w-12 h-1.5 bg-default-200 rounded-full mb-4" />
                <span className="text-lg font-semibold">Navigation</span>
              </DrawerHeader>
              <DrawerBody className="pt-4 pb-10">
                <ScrollShadow className="max-h-[60vh]">
                  <div className="flex flex-col gap-6">
                    {filteredSidebarData.map((group, groupIdx) => (
                      <div key={group.title} className="flex flex-col gap-3">
                        <p className="text-xs font-semibold text-default-400 uppercase tracking-widest px-4">
                          {group.title}
                        </p>
                        <div className="grid grid-cols-1 gap-1">
                          {group.items.map((item) => (
                            <MobileNavItem
                              key={item.key}
                              item={item}
                              activeKey={activeKey}
                              badgeCount={
                                item.key === 'notifications'
                                  ? normalizedUnreadCount
                                  : 0
                              }
                              onSelect={(key, href) => {
                                handleSelect(key, href)
                                onClose()
                              }}
                            />
                          ))}
                        </div>
                        {groupIdx < filteredSidebarData.length - 1 && (
                          <Divider className="mt-2 opacity-50" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollShadow>
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}
