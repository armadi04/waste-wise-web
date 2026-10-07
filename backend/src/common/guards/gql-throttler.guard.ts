import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { isPerUserThrottled } from './user-throttler.guard';

/**
 * Global rate-limit guard that also works over GraphQL. The default
 * {@link ThrottlerGuard} reads `req`/`res` via `switchToHttp()`, which yields
 * the resolver root object (no `req.ip`) under a GraphQL resolver. This override
 * pulls the Express request/response off the Apollo context instead, so the same
 * per-IP throttle applies to `/graphql` as to the REST routes.
 *
 * Routes marked with `@ThrottlePerUser` are left to {@link UserThrottlerGuard},
 * which runs after authentication and buckets by user id.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(isPerUserThrottled(this.reflector, context));
  }

  getRequestResponse(context: ExecutionContext): {
    req: Record<string, any>;
    res: Record<string, any>;
  } {
    if (context.getType<GqlContextType>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context).getContext<{
        req: Record<string, any>;
        res: Record<string, any>;
      }>();
      return { req: ctx.req, res: ctx.res };
    }
    return super.getRequestResponse(context);
  }
}
