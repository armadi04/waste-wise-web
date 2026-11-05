export interface JwtPayload {
  sub: number;
  email: string;
  roles: string[];
  // Only on tokens minted before permissions were dropped from the payload;
  // never read — JwtStrategy reloads permissions from the database.
  permissions?: string[];
  emailVerified: boolean;
  // The single role the user is currently acting as. When set, `roles` (and the
  // permissions JwtStrategy loads) are scoped to it; absent means no role chosen yet (multi-role
  // users must pick one before any role permission is granted).
  activeRole?: string;
  // Set while an administrator is signed in as this user: the id of the real
  // account behind the session, so it can be handed back.
  impersonatorId?: number;
  // Our own device-session id (UserSession.sessionId). Present on every user
  // login; the JWT strategy rejects the token once that session is revoked.
  sessionId?: string;
  // The short-lived token that stands between a correct password and a
  // verified second factor. 'user' marks an
  // access token and 'refresh' a refresh token; tokens minted before the type
  // existed carry none and are treated as legacy user tokens.
  tokenType?: 'user' | '2fa' | 'refresh';
  jti?: string;
}
