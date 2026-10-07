import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, jest } from 'bun:test';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { DataSource, Repository } from 'typeorm';
import {
  PortalGiftAdminService,
  PortalReferralAdminService,
  PortalWalletAdminService,
} from '../../../../src/portal/admin/portal-admin-records.service';
import { PortalCommerceOutbox } from '@/portal/commerce/entities/portal-commerce-outbox.entity';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalGift } from '@/portal/gifts/entities/portal-gift.entity';
import { PortalReferral } from '@/portal/campaigns/entities/portal-referral.entity';
import { PortalWalletTransaction } from '@/portal/commerce/entities/portal-wallet-transaction.entity';
import { PortalWallet } from '@/portal/commerce/entities/portal-wallet.entity';
import type { User } from '../../../../src/users/entities/user.entity';

type Row = Record<string, unknown>;

/** In-memory repositories keyed by entity, enough for the admin action flows. */
function fakeDataSource(seed: Map<unknown, Row[]>) {
  const repo = (entity: unknown) => {
    const rows = seed.get(entity) ?? [];
    seed.set(entity, rows);
    const match = (where: Row) =>
      rows.find((row) => Object.entries(where).every(([k, v]) => row[k] === v));
    return {
      findOne: async ({ where }: { where: Row }) => match(where) ?? null,
      findOneOrFail: async ({ where }: { where: Row }) => {
        const row = match(where);
        if (!row) throw new Error('not found');
        return row;
      },
      // insert().values().orIgnore().execute(): add the row unless the key exists.
      createQueryBuilder: () => {
        let values: Row = {};
        const query = {
          insert: () => query,
          values: (row: Row) => ((values = row), query),
          orIgnore: () => query,
          execute: async () => {
            if (!match({ userId: values.userId }))
              rows.push({ id: rows.length + 1, ...values });
          },
        };
        return query;
      },
      findOneBy: async (where: Row) => match(where) ?? null,
      create: (dto: Row) => ({ ...dto }),
      save: async (row: Row) => {
        if (!rows.includes(row)) {
          row.id ??= rows.length + 1;
          rows.push(row);
        }
        return row;
      },
      update: async () => undefined,
      find: async () => rows,
    };
  };
  const source = {
    transaction: async (run: (manager: unknown) => Promise<unknown>) =>
      run({ getRepository: repo }),
  } as unknown as DataSource;
  return { source, repo };
}

const events = {
  emitAsync: jest.fn(async () => []),
} as unknown as EventEmitter2;

const walletService = (seed: Map<unknown, Row[]>) => {
  const { source } = fakeDataSource(seed);
  const users = {
    findOneBy: async ({ id }: { id: number }) => (id === 404 ? null : { id }),
  } as unknown as Repository<User>;
  return new PortalWalletAdminService(
    {} as Repository<PortalWallet>,
    users,
    source,
    events,
  );
};

describe('PortalWalletAdminService.adjust', () => {
  const dto = {
    userId: 7,
    amount: 5000,
    reason: 'Goodwill credit',
    idempotencyKey: 'key-0001',
  };

  it('credits the wallet once per idempotency key with an adjustment transaction', async () => {
    const seed = new Map<unknown, Row[]>([
      [
        PortalWallet,
        [{ id: 1, userId: 7, balance: 1000, lifetimeEarned: 1000 }],
      ],
    ]);
    const service = walletService(seed);
    expect(await service.adjust(dto, 1)).toEqual({
      userId: 7,
      balance: 6000,
      lifetimeEarned: 6000,
      applied: true,
    });
    expect(await service.adjust(dto, 1)).toEqual({
      userId: 7,
      balance: 6000,
      lifetimeEarned: 6000,
      applied: false,
    });
    const transactions = seed.get(PortalWalletTransaction)!;
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({
      type: 'adjustment',
      amount: 5000,
      operationKey: 'admin:key-0001',
    });
    expect(seed.get(PortalCommerceOutbox)?.[0]).toMatchObject({
      eventName: 'audit.record',
    });
  });

  it('rejects a debit that would make the balance negative', async () => {
    const seed = new Map<unknown, Row[]>([
      [PortalWallet, [{ id: 1, userId: 7, balance: 100, lifetimeEarned: 100 }]],
    ]);
    await expect(
      walletService(seed).adjust({ ...dto, amount: -500 }, 1),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(seed.get(PortalWalletTransaction) ?? []).toHaveLength(0);
  });

  it('rejects a replayed key carrying a different amount', async () => {
    const seed = new Map<unknown, Row[]>([
      [PortalWallet, [{ id: 1, userId: 7, balance: 0, lifetimeEarned: 0 }]],
    ]);
    const service = walletService(seed);
    await service.adjust(dto, 1);
    await expect(
      service.adjust({ ...dto, amount: 1 }, 1),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an unknown user', async () => {
    await expect(
      walletService(new Map()).adjust({ ...dto, userId: 404 }, 1),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PortalGiftAdminService.revoke', () => {
  const setup = (status: string) => {
    const seed = new Map<unknown, Row[]>([
      [
        PortalGift,
        [{ id: 3, status, code: 'GFT-1', couponId: 9, packageId: 4 }],
      ],
      [
        PortalCouponPackage,
        [
          {
            id: 4,
            couponId: 9,
            stockTotal: 10,
            stockRemaining: 2,
            active: true,
          },
        ],
      ],
      [PortalCoupon, [{ id: 9 }]],
    ]);
    const { source } = fakeDataSource(seed);
    return {
      seed,
      service: new PortalGiftAdminService(
        {} as Repository<PortalGift>,
        source,
        events,
      ),
    };
  };

  it('revokes a ready gift and returns its reserved package stock', async () => {
    const { seed, service } = setup('Ready');
    expect(await service.revoke(3, 1, 'Sent to wrong email')).toMatchObject({
      status: 'Revoked',
    });
    expect(seed.get(PortalCouponPackage)![0].stockRemaining).toBe(3);
    expect(seed.get(PortalCommerceOutbox)?.[0]).toMatchObject({
      operationKey: 'gift-revoke:3',
    });
  });

  it('refuses gifts that are already redeemed', async () => {
    const { seed, service } = setup('Redeemed');
    await expect(service.revoke(3, 1, 'Too late now')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(seed.get(PortalCouponPackage)![0].stockRemaining).toBe(2);
  });
});

describe('read-only portal admin services', () => {
  it('reject generic writes', async () => {
    const service = new PortalReferralAdminService(
      {} as Repository<PortalReferral>,
    );
    await expect(service.create()).rejects.toBeInstanceOf(ConflictException);
    await expect(service.update()).rejects.toBeInstanceOf(ConflictException);
    await expect(service.remove()).rejects.toBeInstanceOf(ConflictException);
    await expect(service.removeMany()).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
