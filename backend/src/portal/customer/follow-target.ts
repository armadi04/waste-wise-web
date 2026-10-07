export const FOLLOW_TARGET_TYPES = ['coupon', 'event', 'merchant'] as const;
export type FollowTargetType = (typeof FOLLOW_TARGET_TYPES)[number];
