import type { Request } from 'express';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  roles: string[];
  permissions: string[];
  emailVerified: boolean;
  // The role the user is currently acting as, if one has been chosen.
  activeRole?: string;
  // OIDC session id — present only for SSO-minted sessions. Surfaced to the SPA
  // (via /auth/me) so logout can be routed through RP-initiated logout.
  sid?: string;
  // Present while this session is an impersonation: the administrator's own id.
  impersonatorId?: number;
  // Device-session id backing this token, so the sessions endpoints can tell
  // which row is "this device" and logout can revoke exactly it.
  sessionId?: string;
  // Set for OAuth2 client_credentials principals; `permissions` holds the
  // granted scopes so @Permissions() guards apply uniformly.
  isClient?: boolean;
  clientId?: string;
}

export interface IAuthRequest extends Request {
  user: AuthenticatedUser;
}
