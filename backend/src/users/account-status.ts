export const ACCOUNT_STATUS_VALUES = [
  'INACTIVE',
  'ACTIVE',
  'UNVERIFIED',
  'LOCKED',
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUS_VALUES)[number];
