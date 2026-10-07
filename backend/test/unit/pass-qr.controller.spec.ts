import { describe, expect, it, mock } from 'bun:test';
import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';

// Bun's test runner cannot statically load @nestjs/throttler alongside the
// passport-based auth guards (require() of an async module), so everything
// Nest-side is imported dynamically, in dependency order.
const { Reflector } = await import('@nestjs/core');
const { ThrottlerException, ThrottlerStorageService } =
  await import('@nestjs/throttler');
const { JwtAuthGuard } = await import('@/auth/jwt-auth.guard');
const { PermissionsGuard } = await import('@/auth/permissions.guard');
const { PERMISSIONS_KEY } = await import('@/auth/permissions.decorator');
const { GqlThrottlerGuard } =
  await import('@/common/guards/gql-throttler.guard');
const { THROTTLE_PER_USER, UserThrottlerGuard } =
  await import('@/common/guards/user-throttler.guard');
const { PortalController } = await import('@/portal/portal.controller');
const { PortalAdminController } =
  await import('@/portal/admin/portal-admin.controller');
// GUARDS_METADATA / HEADERS_METADATA from @nestjs/common/constants.
const GUARDS_METADATA = '__guards__';
const HEADERS_METADATA = '__headers__';
const reflector = new Reflector();
const customerQrRoutes = ['getVoucherQr', 'getTicketQr'] as const;

function context(
  handlerName: string,
  req: Record<string, unknown>,
): ExecutionContext {
  const handler = PortalController.prototype[handlerName];
  const res = { header: () => undefined };
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => PortalController,
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
}

async function guards() {
  const options = [{ name: 'default', ttl: 60_000, limit: 100 }];
  const storage = new ThrottlerStorageService();
  const perUser = new UserThrottlerGuard(options, storage, reflector);
  const global = new GqlThrottlerGuard(options, storage, reflector);
  await perUser.onModuleInit();
  await global.onModuleInit();
  return { perUser, global, storage };
}

describe('customer pass QR routes', () => {
  for (const route of customerQrRoutes) {
    it(`${route}: authenticates before the per-user throttle and is never cached`, () => {
      const handler = PortalController.prototype[route];
      expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
        JwtAuthGuard,
        UserThrottlerGuard,
      ]);
      expect(Reflect.getMetadata(THROTTLE_PER_USER, handler)).toBe(true);
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(30);
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
      expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({
        name: 'Cache-Control',
        value: 'no-store',
      });
    });
  }
});

describe('per-user throttling', () => {
  it('buckets by user id so customers behind one NAT IP do not share a limit', async () => {
    const { perUser } = await guards();
    const req = (userId: number) => ({
      ip: '10.0.0.1',
      headers: {},
      user: { userId },
    });
    for (let i = 0; i < 30; i++)
      expect(await perUser.canActivate(context('getVoucherQr', req(1)))).toBe(
        true,
      );
    await expect(
      perUser.canActivate(context('getVoucherQr', req(1))),
    ).rejects.toThrow(ThrottlerException);
    expect(await perUser.canActivate(context('getVoucherQr', req(2)))).toBe(
      true,
    );
  });

  it('leaves per-user routes to the route guard and everything else to the global per-IP guard', async () => {
    const { perUser, global, storage } = await guards();
    const req = { ip: '10.0.0.1', headers: {}, user: { userId: 1 } };
    const increment = mock(storage.increment.bind(storage));
    storage.increment = increment;

    await global.canActivate(context('getVoucherQr', req));
    expect(increment).not.toHaveBeenCalled();

    await perUser.canActivate(context('getVoucher', req));
    expect(increment).not.toHaveBeenCalled();

    await global.canActivate(context('getVoucher', req));
    expect(increment).toHaveBeenCalledTimes(1);
  });

  it('tracks by user id, falling back to the IP when unauthenticated', async () => {
    const { perUser } = await guards();
    const tracker = perUser.getTracker.bind(perUser);
    expect(await tracker({ ip: '10.0.0.1', user: { userId: 7 } })).toBe(
      'user:7',
    );
    expect(await tracker({ ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
  });
});

describe('staff scan routes', () => {
  it('requires the order refund permission for refund approval and authenticated ownership for sandbox confirmation', () => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        PortalAdminController.prototype.approveRefund,
      ),
    ).toEqual(['portal.orders.refund']);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        PortalController.prototype.simulatePayment,
      ),
    ).toEqual([JwtAuthGuard]);
  });

  const cases = [
    ['scanVoucher', 'voucher', 'portal.vouchers.redeem'],
    ['scanTicket', 'ticket', 'portal.tickets.check_in'],
  ] as const;

  it('inherit the controller auth, CSRF and permission guards', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PortalAdminController),
    ).toContain(PermissionsGuard);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, PortalAdminController),
    ).toContain(JwtAuthGuard);
  });

  for (const [handler, kind, permission] of cases) {
    it(`${handler}: requires ${permission} and resolves, verifies, then clears cache`, async () => {
      const method = PortalAdminController.prototype[handler];
      expect(Reflect.getMetadata(PERMISSIONS_KEY, method)).toEqual([
        permission,
      ]);

      const calls: string[] = [];
      const controller = Object.assign(
        Object.create(PortalAdminController.prototype),
        {
          passQr: {
            resolve: mock(async (k: string, token: string) => {
              calls.push(`resolve:${k}:${token}`);
              return 42;
            }),
          },
          campaignEngine: {
            verifyUsage: mock(async (k: string, id: number, actor: number) => {
              calls.push(`verify:${k}:${id}:${actor}`);
              return { verified: true };
            }),
          },
          cacheService: {
            clearKeys: mock(async (pattern: string) => {
              calls.push(`clear:${pattern}`);
            }),
          },
        },
      );

      const result = await controller[handler](
        { token: 'KM1.token' },
        { user: { userId: 5 } },
      );
      expect(result).toEqual({ verified: true });
      expect(calls).toEqual([
        `resolve:${kind}:KM1.token`,
        `verify:${kind}:42:5`,
        'clear:*/portal*',
      ]);
    });
  }

  it('does not verify or clear cache when the token is refused', async () => {
    const verifyUsage = mock(async () => ({ verified: true }));
    const clearKeys = mock(async () => undefined);
    const controller = Object.assign(
      Object.create(PortalAdminController.prototype),
      {
        passQr: {
          resolve: mock(async () => {
            throw new Error('refused');
          }),
        },
        campaignEngine: { verifyUsage },
        cacheService: { clearKeys },
      },
    );
    await expect(
      controller.scanVoucher({ token: 'KM1.bad' }, {
        user: { userId: 5 },
      } as any),
    ).rejects.toThrow('refused');
    expect(verifyUsage).not.toHaveBeenCalled();
    expect(clearKeys).not.toHaveBeenCalled();
  });
});
