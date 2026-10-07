import { describe, expect, it, mock } from 'bun:test';
import { firstValueFrom, of, throwError } from 'rxjs';
import { CacheInvalidationListener } from '@/common/cache/cache-invalidation.listener';
import { ClearCacheOnWrite } from '@/common/cache/clear-cache-on-write.interceptor';

describe('cross-resource cache invalidation', () => {
  it('clears users when account and role events reach the listener', async () => {
    const clearKeys = mock(async () => {});
    await new CacheInvalidationListener({ clearKeys } as any).clearUsers();
    expect(clearKeys).toHaveBeenCalledWith('*/users*');
  });
  it('clears resource lists after successful writes, preserving read and failed request caches', async () => {
    const clearKeys = mock(async () => {});
    const Interceptor = ClearCacheOnWrite('*/users*');
    const interceptor = new Interceptor({ clearKeys } as any);
    const context = (method: string) =>
      ({
        getType: () => 'http',
        switchToHttp: () => ({ getRequest: () => ({ method }) }),
      }) as any;
    for (const method of ['GET', 'HEAD'])
      expect(
        await firstValueFrom(
          interceptor.intercept(context(method), { handle: () => of('ok') }),
        ),
      ).toBe('ok');
    expect(clearKeys).not.toHaveBeenCalled();
    await expect(
      firstValueFrom(
        interceptor.intercept(context('POST'), {
          handle: () => throwError(() => new Error('write failed')),
        }),
      ),
    ).rejects.toThrow('write failed');
    expect(clearKeys).not.toHaveBeenCalled();
    expect(
      await firstValueFrom(
        interceptor.intercept(context('POST'), {
          handle: () => of({ saved: true }),
        }),
      ),
    ).toEqual({ saved: true });
    expect(clearKeys).toHaveBeenCalledWith('*/users*');
  });
});
