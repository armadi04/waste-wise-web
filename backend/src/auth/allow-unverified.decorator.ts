import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_KEY = 'allowUnverified';

/**
 * Marks a route as accessible to authenticated users whose email address has
 * not been verified yet. Use sparingly — only on endpoints that must stay
 * reachable before verification (e.g. fetching the profile needed to render
 * the "verify your email" screen, or logging out).
 */
export const AllowUnverified = () => SetMetadata(ALLOW_UNVERIFIED_KEY, true);
