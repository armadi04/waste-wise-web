import { Avatar, Skeleton } from '@heroui/react'
import { BadgeCheck, Pencil } from 'lucide-react'
import type { UserProfile } from '@/types/auth'
import { Button, Chip } from '@/components/shared/controls'

interface ProfileHeroCardProps {
  profile: UserProfile | undefined
  isLoading: boolean
  activeRole?: string
  onEdit: () => void
}

export function ProfileHeroCard({
  profile,
  isLoading,
  activeRole,
  onEdit,
}: ProfileHeroCardProps) {
  if (isLoading) return <HeroSkeleton />

  const verified = !!profile?.emailVerifiedAt

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <Avatar
        src={profile?.avatar?.url || undefined}
        name={profile?.fullname?.charAt(0)}
        className="h-16 w-16 shrink-0 text-xl"
        color="primary"
        isBordered
      />

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
            {profile?.fullname || '—'}
          </h1>
          {verified && (
            <BadgeCheck
              size={18}
              className="shrink-0 text-[var(--app-success)]"
            />
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-default-500">
          {profile?.email}
        </p>

        {profile?.roles?.length ? (
          <div className="mt-2.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {profile.roles.map((role) => {
              const isActive = role.name === activeRole
              return (
                <Chip
                  key={role.id}
                  size="sm"
                  color="primary"
                  variant={isActive ? 'solid' : 'flat'}
                  className="font-medium capitalize"
                >
                  {role.name}
                  {isActive ? ' · active' : ''}
                </Chip>
              )
            })}
          </div>
        ) : null}
      </div>

      <Button
        variant="bordered"
        startContent={<Pencil size={15} />}
        onPress={onEdit}
        className="shrink-0 border-default-200 font-medium"
      >
        Edit Profile
      </Button>
    </div>
  )
}

function HeroSkeleton() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-6 w-48 rounded-large" />
        <Skeleton className="h-4 w-36 rounded-large" />
        <div className="mt-1 flex gap-1.5">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
    </div>
  )
}
