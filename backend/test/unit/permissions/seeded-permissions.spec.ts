import { describe, expect, it } from 'bun:test';
import 'reflect-metadata';

// Nest modules load dynamically for the same reason as pass-qr.controller.spec.
const { PERMISSIONS_KEY } = await import('@/auth/permissions.decorator');
const { SEEDED_PERMISSIONS } = await import('@/database/seeder/seeder.service');
const { PortalAdminController } =
  await import('@/portal/admin/portal-admin.controller');
const { PortalAdminRecordsController } =
  await import('@/portal/admin/portal-admin-records.controller');

const names = SEEDED_PERMISSIONS.map((permission) => permission.name);

describe('seeded permissions', () => {
  it('are unique', () => {
    expect(new Set(names).size).toBe(names.length);
  });

  it('omit create permissions for resources without a create route', () => {
    expect(names).not.toContain('portal.reviews.create');
    expect(names).not.toContain('portal.bookings.create');
  });

  it('seed every permission required by a portal admin route', () => {
    const required = [PortalAdminController, PortalAdminRecordsController]
      .map((controller) => controller.prototype as Record<string, unknown>)
      .flatMap((prototype) =>
        Object.getOwnPropertyNames(prototype).flatMap(
          (method) =>
            (Reflect.getMetadata(
              PERMISSIONS_KEY,
              prototype[method] as object,
            ) ?? []) as string[],
        ),
      );
    expect(required.length).toBeGreaterThan(0);
    for (const permission of required) expect(names).toContain(permission);
  });

  it.each([
    ['redeemVoucher', 'portal.vouchers.redeem'],
    ['scanVoucher', 'portal.vouchers.redeem'],
    ['checkInTicket', 'portal.tickets.check_in'],
    ['scanTicket', 'portal.tickets.check_in'],
    ['approveRefund', 'portal.orders.refund'],
    ['rejectRefund', 'portal.orders.refund'],
    ['adjustCampaignPoints', 'portal.campaign_progress.adjust'],
  ] as const)('%s requires dedicated %s', (method, permission) => {
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        PortalAdminController.prototype[method],
      ),
    ).toEqual([permission]);
  });
});
