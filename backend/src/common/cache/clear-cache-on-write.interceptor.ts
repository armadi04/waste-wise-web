import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  mixin,
  type Type,
} from '@nestjs/common';
import { from, Observable, switchMap } from 'rxjs';
import { getRequest } from '../helpers/execution-context.util';
import { CacheService } from './cache.service';

/**
 * Clears cached responses matching `pattern` after every successful write
 * (non-GET) a controller handles — for writes whose results show up in
 * another controller's cached reads, e.g. customer actions in admin lists.
 */
export function ClearCacheOnWrite(pattern: string): Type<NestInterceptor> {
  @Injectable()
  class ClearCacheOnWriteInterceptor implements NestInterceptor {
    constructor(private readonly cacheService: CacheService) {}

    intercept(
      context: ExecutionContext,
      next: CallHandler,
    ): Observable<unknown> {
      const method = getRequest(context)?.method;
      if (!method || method === 'GET' || method === 'HEAD')
        return next.handle();
      return next
        .handle()
        .pipe(
          switchMap((result: unknown) =>
            from(this.cacheService.clearKeys(pattern).then(() => result)),
          ),
        );
    }
  }
  return mixin(ClearCacheOnWriteInterceptor);
}
