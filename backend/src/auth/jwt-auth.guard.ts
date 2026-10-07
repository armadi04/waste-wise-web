import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { ALLOW_UNVERIFIED_KEY } from './allow-unverified.decorator';
import type { IAuthRequest } from './interfaces/auth-request.interface';

/**
 * Authenticates the request via the JWT strategy and additionally requires the
 * user's email address to be verified. Routes decorated with
 * `@AllowUnverified()` skip the verification check.
 *
 * `getRequest` is overridden so Passport reads the request from the GraphQL
 * context when the guard runs over a resolver instead of a REST route.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  getRequest<T = IAuthRequest>(context: ExecutionContext): T {
    if (context.getType<GqlContextType>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext<{ req: T }>().req;
    }
    return context.switchToHttp().getRequest<T>();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAuthenticated = (await super.canActivate(context)) as boolean;
    if (!isAuthenticated) {
      return false;
    }

    const allowUnverified = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNVERIFIED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowUnverified) {
      return true;
    }

    const { user } = this.getRequest<IAuthRequest>(context);
    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Please verify your email address to continue.',
      );
    }

    return true;
  }
}
