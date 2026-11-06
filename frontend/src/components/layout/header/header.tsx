import {
  Avatar,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
  Kbd,
  Skeleton,
} from '@heroui/react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Check,
  ChevronRight,
  LogOut,
  PanelLeft,
  Repeat,
  Search,
  User,
  UserCog,
} from 'lucide-react'
import { useState } from 'react'
import { Button, Dropdown, DropdownItem } from '@/components/shared/controls'
import { ProfileDrawer } from '@/components/features/profile/drawer/profile-drawer'
import { NotificationDropdown } from '@/components/features/notifications/components/notification-dropdown'
import { useAuth, useProfile } from '@/hooks/auth'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useCommandPaletteStore } from '@/lib/stores/command-palette.store'
import { usePageHeaderStore } from '@/lib/stores/page-header.store'
import { useSidebar } from '@/lib/stores/sidebar.store'

export const Header = () => {
  const { data: profile, isLoading } = useProfile()
  const { user, switchRole } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const breadcrumbs = usePageHeaderStore((s) => s.breadcrumbs)
  const { toggleSidebar } = useSidebar()
  const openCommandPalette = useCommandPaletteStore((s) => s.open)

  const roles = profile?.roles ?? []
  const activeRole = user?.activeRole

  // Re-scope to another assigned role, then refetch permission-gated data.
  const onSwitchRole = async (role: string) => {
    if (role === activeRole) return
    const result = await switchRole(role)
    if (result.success) await queryClient.invalidateQueries()
  }

  return (
    <>
      <header className="flex items-center justify-between gap-3 h-16 px-4 sm:px-6 top-0 z-30 bg-content1 border-b border-divider shrink-0">
        {/* Left: sidebar toggle + breadcrumb trail (the page's own title band
            lives here now, published by PageHeader). */}
        <div className="flex min-w-0 items-center gap-2">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label="Toggle sidebar"
            onPress={toggleSidebar}
            className="hidden shrink-0 text-default-500 lg:flex"
          >
            <PanelLeft size={18} />
          </Button>
          <div className="mr-1 hidden h-4 w-px shrink-0 bg-divider lg:block" />
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-sm"
          >
            <Link
              to="/"
              className="-my-2 shrink-0 py-2 font-medium text-[var(--app-link)] transition-colors hover:text-[var(--app-link-hover)]"
            >
              Home
            </Link>
            {breadcrumbs.map((bc, i) => (
              <span key={i} className="flex min-w-0 items-center gap-1.5">
                <ChevronRight size={14} className="shrink-0 text-default-400" />
                {bc.href && !bc.isCurrent ? (
                  <Link
                    to={bc.href}
                    className="-my-2 truncate py-2 font-medium text-[var(--app-link)] transition-colors hover:text-[var(--app-link-hover)]"
                  >
                    {bc.label}
                  </Link>
                ) : (
                  <span
                    className={
                      bc.isCurrent
                        ? 'truncate font-semibold text-foreground'
                        : 'truncate font-medium text-default-500'
                    }
                  >
                    {bc.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Command palette trigger — sits left of the notification bell. */}
          <Button
            size="sm"
            variant="flat"
            aria-label="Open command palette"
            onPress={openCommandPalette}
            className="hidden text-default-500 sm:flex"
            startContent={<Search size={16} />}
            endContent={<Kbd keys={['command']}>K</Kbd>}
          >
            Search
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label="Open command palette"
            onPress={openCommandPalette}
            className="text-default-500 sm:hidden"
          >
            <Search size={18} />
          </Button>
          <NotificationDropdown />

          {/* Symmetric ml/pl around the rule, and the same gap as the icon row, so
              the search / bell / avatar cluster reads as evenly spaced. */}
          <div className="flex items-center gap-2 ml-2 pl-4 border-l border-default-200">
            {isLoading ? (
              <>
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-3 w-24 rounded-large" />
                  <Skeleton className="h-3 w-16 rounded-large" />
                </div>
                <Skeleton className="rounded-full w-10 h-10" />
              </>
            ) : (
              <Dropdown
                classNames={{ content: 'shadow-xl' }}
                placement="bottom-end"
                // Keep the row at full size while the menu is open; it reads as
                // disabled instead of shrinking.
                triggerScaleOnOpen={false}
                isOpen={isUserMenuOpen}
                onOpenChange={setIsUserMenuOpen}
              >
                <DropdownTrigger>
                  <div className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-80">
                    <div className="hidden sm:flex flex-col items-end gap-1">
                      <p className="text-sm font-semibold leading-none">
                        {profile?.fullname}
                      </p>
                      <p className="text-xs text-default-500">
                        {profile?.email}
                      </p>
                    </div>
                    <Avatar
                      src={profile?.avatar?.url || undefined}
                      name={profile?.fullname?.charAt(0)}
                      isBordered
                      color="primary"
                    />
                  </div>
                </DropdownTrigger>
                <DropdownMenu aria-label="Profile Actions" variant="flat">
                  <DropdownItem
                    key="info"
                    className="h-14 gap-2"
                    textValue="Signed in as"
                    isReadOnly
                  >
                    <p className="font-semibold">Signed in as</p>
                    <p className="font-semibold">{profile?.email}</p>
                  </DropdownItem>
                  {roles.length > 1 ? (
                    <DropdownItem
                      key="switch-role"
                      isReadOnly
                      closeOnSelect={false}
                      textValue="Switch role"
                      className="p-0 data-[hover=true]:bg-transparent"
                    >
                      <Dropdown
                        placement="right-start"
                        classNames={{ content: 'shadow-xl' }}
                      >
                        <DropdownTrigger>
                          <div className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-small px-2 py-1.5 transition-colors hover:bg-default-100">
                            <span className="flex items-center gap-2">
                              <Repeat size={18} />
                              Switch role
                            </span>
                            <span className="flex items-center gap-1 text-default-400">
                              <span className="text-xs capitalize">
                                {activeRole}
                              </span>
                              <ChevronRight size={16} />
                            </span>
                          </div>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Select role" variant="flat">
                          {roles.map((role) => {
                            const isActive = role.name === activeRole
                            return (
                              <DropdownItem
                                key={`role-${role.name}`}
                                textValue={role.name}
                                className={
                                  isActive
                                    ? 'bg-[var(--app-selected-background)]'
                                    : ''
                                }
                                endContent={
                                  isActive ? (
                                    <Check
                                      size={16}
                                      className="text-[var(--app-link)]"
                                    />
                                  ) : null
                                }
                                onPress={() => void onSwitchRole(role.name)}
                              >
                                <span
                                  className={`capitalize ${
                                    isActive
                                      ? 'font-semibold text-[var(--app-link)]'
                                      : 'text-default-700'
                                  }`}
                                >
                                  {role.name}
                                </span>
                              </DropdownItem>
                            )
                          })}
                        </DropdownMenu>
                      </Dropdown>
                    </DropdownItem>
                  ) : null}
                  <DropdownSection showDivider>
                    <DropdownItem
                      key="profile"
                      startContent={<User size={18} />}
                      onPress={() => void navigate({ to: '/profile' })}
                    >
                      My Profile
                    </DropdownItem>
                    <DropdownItem
                      key="edit"
                      startContent={<UserCog size={18} />}
                      onPress={() => setIsDrawerOpen(true)}
                    >
                      Edit Profile
                    </DropdownItem>
                  </DropdownSection>
                  <DropdownItem
                    key="logout"
                    color="danger"
                    startContent={<LogOut size={18} />}
                    onPress={() => logout()}
                  >
                    Log Out
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            )}
          </div>
        </div>
      </header>

      <ProfileDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        user={profile || null}
      />
    </>
  )
}
