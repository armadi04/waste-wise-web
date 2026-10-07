import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type {
  AuthenticatedUser,
  IAuthRequest,
} from '@/auth/interfaces/auth-request.interface';

/**
 * Resolver param decorator that returns the authenticated user off the GraphQL
 * context — the counterpart to reading `req.user` in a REST controller. Only
 * meaningful behind a guard that populates `req.user` (e.g. GqlAuthGuard).
 */
export const GqlCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const { req } = GqlExecutionContext.create(context).getContext<{
      req: IAuthRequest;
    }>();
    return req.user;
  },
);
