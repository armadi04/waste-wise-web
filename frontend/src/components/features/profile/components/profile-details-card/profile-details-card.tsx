import { Chip, Divider } from '@heroui/react'
import {
  AtSign,
  BadgeCheck,
  KeyRound,
  Phone,
  Shield,
  ShieldAlert,
  User,
} from 'lucide-react'
import type { ProfileDetailsCardProps } from '@/components/features/profile/components/profile-details-card/types'

import { DetailsSkeleton } from '@/components/features/profile/components/profile-details-card/child/details-skeleton'

/** Identity, roles and direct permissions — everything the account *is*. */
export function ProfileDetailsCard({
  profile,
  isLoading,
  activeRole,
}: ProfileDetailsCardProps) {
  const verified = !!profile?.emailVerifiedAt

  return (
    <section>
      <h3 className="mb-4 text-lg font-semibold tracking-tight">
        Account Details
      </h3>

      {isLoading ? (
        <DetailsSkeleton />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Chip
              variant="flat"
              startContent={<User size={14} />}
              className="gap-1 pl-2.5"
            >
              {profile?.fullname || '—'}
            </Chip>
            <Chip
              variant="flat"
              startContent={<AtSign size={14} />}
              className="gap-1 pl-2.5"
            >
              {profile?.email}
            </Chip>
            <Chip
              variant="flat"
              startContent={<Phone size={14} />}
              className="gap-1 pl-2.5"
            >
              {profile?.phone || '—'}
            </Chip>
            <Chip
              variant="flat"
              color={verified ? 'success' : 'warning'}
              startContent={
                verified ? <BadgeCheck size={14} /> : <ShieldAlert size={14} />
              }
              className="gap-1 pl-2.5 font-medium"
            >
              {verified ? 'Email verified' : 'Email not verified'}
            </Chip>
          </div>

          <Divider className="opacity-50" />

          {/* Roles */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-large bg-primary/10">
                <Shield size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Roles</p>
                <p className="text-xs text-default-400">
                  {profile?.roles?.length ?? 0} assigned
                </p>
              </div>
            </div>

            {profile?.roles?.length ? (
              <div className="flex flex-wrap gap-1.5 pl-1">
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
            ) : (
              <p className="pl-1 text-xs text-default-300 italic">
                No roles assigned
              </p>
            )}
          </div>

          <Divider className="opacity-50" />

          {/* Permissions */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-large bg-warning/10">
                <KeyRound size={16} className="text-warning" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Permissions
                </p>
                <p className="text-xs text-default-400">
                  {profile?.permissions?.length ?? 0} total
                </p>
              </div>
            </div>

            {profile?.permissions?.length ? (
              <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto pl-1">
                {profile.permissions.map((permission) => (
                  <Chip
                    key={permission.id}
                    size="sm"
                    variant="bordered"
                    className="font-mono text-tiny text-default-500"
                  >
                    {permission.name}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="pl-1 text-xs text-default-300 italic">
                No direct permissions
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
