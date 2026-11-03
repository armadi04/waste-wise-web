import type { AccountStatus } from './account-status';
import { User } from './entities/user.entity';

export function deriveAccountStatus(
  user: Pick<User, 'isActive' | 'lockedUntil' | 'emailVerifiedAt'>,
): AccountStatus {
  if (user.isActive === false) return 'INACTIVE';
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now())
    return 'LOCKED';
  return user.emailVerifiedAt ? 'ACTIVE' : 'UNVERIFIED';
}

/**
 * Clone the entity so view-only fields never mutate the persistence model.
 * Preserve the prototype so ClassSerializer still applies @Exclude metadata.
 */
export function presentUser(user: User): User {
  const view = Object.assign(new User(), user);
  view.accountStatus = deriveAccountStatus(user);
  return view;
}

export function presentUsers(users: User[]): User[] {
  return users.map((user) => presentUser(user));
}
