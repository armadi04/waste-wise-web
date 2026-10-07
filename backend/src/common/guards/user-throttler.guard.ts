import {
  applyDecorators,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

export const THROTTLE_PER_USER = 'throttle:per-user';

/**
 * Rate-limits a route per authenticated user instead of per IP. Customers at a
 * venue often share one NAT'd IP, so a per-IP bucket would lock out a whole
 * queue. The global {@link GqlThrottlerGuard} skips these routes; pair this
 * with `@UseGuards(JwtAuthGuard, UserThrottlerGuard)` so `req.user` is set
 * before the bucket is chosen (global guards run before route guards).
 */
export const ThrottlePerUser = (limit: number, ttl: number) =>
  applyDecorators(
    SetMetadata(THROTTLE_PER_USER, true),
    Throttle({ default: { limit, ttl } }),
  );

export const isPerUserThrottled = (
  reflector: Reflector,
  context: ExecutionContext,
) =>
  reflector.getAllAndOverride<boolean>(THROTTLE_PER_USER, [
    context.getHandler(),
    context.getClass(),
  ]) === true;

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    return Promise.resolve(!isPerUserThrottled(this.reflector, context));
  }

  protected getTracker(req: Record<string, any>): Promise<string> {
    const userId = (req.user as { userId?: number } | undefined)?.userId;
    return Promise.resolve(userId ? `user:${userId}` : `ip:${String(req.ip)}`);
  }
}
