import type { FastifyRequest as Request } from 'fastify';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  roles: string[];
  permissions: string[];
  emailVerified: boolean;
  // The role the user is currently acting as, if one has been chosen.
  activeRole?: string;
  // Present while this session is an impersonation: the administrator's own id.
  impersonatorId?: number;
  // Device-session id backing this token, so the sessions endpoints can tell
  // which row is "this device" and logout can revoke exactly it.
  sessionId?: string;
}

export interface IAuthRequest extends Request<{
  Params: Record<string, string>;
}> {
  user: AuthenticatedUser;
}
