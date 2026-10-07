import { useDisclosure } from '@heroui/react'
import { getRouteApi } from '@tanstack/react-router'
import { ProfileDetailsCard } from '@/components/features/profile/components/profile-details-card'
import { ProfileHeroCard } from '@/components/features/profile/components/profile-hero-card'
import { ProfileSecurityCard } from '@/components/features/profile/components/profile-security-card'
import { ProfileSessionsCard } from '@/components/features/profile/components/profile-sessions-card'
import { AppearanceSection } from '@/components/features/settings/components/appearance-section'
import { BroadcastReloadSection } from '@/components/features/settings/components/broadcast-reload-section'
import { DataSection } from '@/components/features/settings/components/data-section'
import { InstallSection } from '@/components/features/settings/components/install-section'
import { NotificationsSection } from '@/components/features/settings/components/notifications-section'
import { TimeZonePreference } from '@/components/features/settings/components/time-zone-preference'
import { UpdateSection } from '@/components/features/settings/components/update-section'
import { ProfileDrawer } from '@/components/features/profile/drawer/profile-drawer'
import { PageHeader } from '@/components/layout/page-header'
import { SectionNavLayout } from '@/components/layout/section-nav-layout'
import { useAuth, useProfile } from '@/hooks/auth'

const routeApi = getRouteApi('/profile')

const SECTIONS = [
  { key: 'profile', label: 'Profile' },
  { key: 'security', label: 'Security' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'settings', label: 'Settings' },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

export function ProfilePage() {
  const { data: profile, isLoading } = useProfile()
  const { user } = useAuth()
  const activeRole = user?.activeRole
  const { isOpen, onOpen, onOpenChange } = useDisclosure()

  const navigate = routeApi.useNavigate()
  const section: SectionKey = routeApi.useSearch().section ?? 'profile'

  return (
    <div>
      <PageHeader
        title="Profile"
        breadcrumbs={[{ label: 'Profile', isCurrent: true }]}
      />

      <SectionNavLayout
        sections={SECTIONS}
        active={section}
        onChange={(key) => void navigate({ search: { section: key } })}
        bare={section === 'settings'}
      >
        {section === 'profile' && (
          <div className="flex flex-col gap-8">
            <ProfileHeroCard
              profile={profile}
              isLoading={isLoading}
              activeRole={activeRole}
              onEdit={onOpen}
            />
            <ProfileDetailsCard
              profile={profile}
              isLoading={isLoading}
              activeRole={activeRole}
            />
          </div>
        )}

        {section === 'security' && <ProfileSecurityCard />}
        {section === 'sessions' && <ProfileSessionsCard />}
        {section === 'settings' && (
          <div className="flex flex-col gap-6">
            <TimeZonePreference />
            <AppearanceSection />
            <NotificationsSection />
            <InstallSection />
            <UpdateSection />
            <DataSection />
            <BroadcastReloadSection />
          </div>
        )}
      </SectionNavLayout>

      <ProfileDrawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        user={profile || null}
      />
    </div>
  )
}
