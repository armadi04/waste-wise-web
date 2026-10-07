import type { EntityManager, Repository } from 'typeorm';
import type { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import type { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import type { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import type { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import type { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';
import type { User } from '@/users/entities/user.entity';
import { describe, expect, it, mock } from 'bun:test';
import { ConflictException } from '@nestjs/common';
import {
  PortalVoucherAdminService,
  PortalTicketAdminService,
  PortalCampaignAdminService,
} from '@/portal/admin/portal-admin.service';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';
import {
  campaignRulesEqual,
  type CampaignRules,
} from '@/portal/campaigns/campaign-rules';
import { IsUniqueConstraint } from '@/common/validators/is-unique.validator';
import { getMetadataStorage } from 'class-validator';
import {
  CreatePortalVoucherDto,
  CreatePortalTicketDto,
  CreatePortalOrderDto,
} from '@/portal/admin/dto/admin.dto';

type PassRow = {
  id: number;
  orderItemId: number | null;
  status: string;
  imageUrl: string;
  userId: number;
  couponId: number;
  eventId: number;
  ticketTypeId: number;
  expiresAt: Date;
  redeemedAt: Date | null;
  checkedInAt: Date | null;
};

function passFixture(kind: 'voucher' | 'ticket', linked = true) {
  const row: PassRow = {
    id: 1,
    orderItemId: linked ? 5 : null,
    status: 'Issued',
    imageUrl: '/old.jpg',
    userId: 7,
    couponId: 9,
    eventId: 9,
    ticketTypeId: 10,
    expiresAt: new Date('2027-01-01T00:00:00Z'),
    redeemedAt: null,
    checkedInAt: null,
  };
  let queue = Promise.resolve();
  let locked = false;
  const updates: object[] = [];
  const repository = {
    findOne: async (options: { lock: { mode: string } }) => {
      expect(locked).toBe(true);
      expect(options.lock.mode).toBe('pessimistic_write');
      return { ...row };
    },
    update: async (_id: number, dto: object) => {
      expect(locked).toBe(true);
      updates.push(dto);
      Object.assign(row, dto);
    },
    findOneByOrFail: async () => ({ ...row }),
  };
  const manager = {
    getRepository: () => repository,
  } as unknown as EntityManager;
  async function transaction<T>(
    run: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    locked = true;
    try {
      return await run(manager);
    } finally {
      locked = false;
      release();
    }
  }
  const related = { findOneBy: async () => ({ id: 9, eventId: 9 }) };
  const service =
    kind === 'voucher'
      ? new PortalVoucherAdminService(
          {
            ...repository,
            manager: { transaction },
          } as unknown as Repository<PortalVoucher>,
          related as unknown as Repository<User>,
          related as unknown as Repository<PortalCoupon>,
        )
      : new PortalTicketAdminService(
          {
            ...repository,
            manager: { transaction },
          } as unknown as Repository<PortalTicket>,
          related as unknown as Repository<User>,
          related as unknown as Repository<PortalEvent>,
          related as unknown as Repository<PortalEventTicket>,
        );
  return { service, row, updates, transaction };
}

describe('pass edits serialized with usage', () => {
  for (const kind of ['voucher', 'ticket'] as const) {
    it(`${kind}: strips unchanged protected fields from a metadata write`, async () => {
      const { service, updates } = passFixture(kind);
      const fields =
        kind === 'voucher'
          ? {
              couponId: 9,
              expiresAt: new Date('2027-01-01T07:00:00+07:00'),
              redeemedAt: null,
            }
          : { eventId: 9, ticketTypeId: 10, checkedInAt: null };
      await service.update(1, {
        userId: 7,
        status: 'Issued',
        ...fields,
        imageUrl: '/new.jpg',
      });
      expect(updates).toEqual([{ imageUrl: '/new.jpg' }]);
    });
    it(`${kind}: rejects actual ownership changes before any write`, async () => {
      const { service, updates } = passFixture(kind);
      await expect(service.update(1, { userId: 8 })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(updates).toEqual([]);
    });
    it(`${kind}: preserves usage committed immediately after metadata editing`, async () => {
      const { service, row, transaction } = passFixture(kind);
      const edit = service.update(1, {
        status: 'Issued',
        imageUrl: '/new.jpg',
      });
      const usage = transaction(async () => {
        row.status = kind === 'voucher' ? 'Redeemed' : 'CheckedIn';
      });
      await Promise.all([edit, usage]);
      expect(row.status).toBe(kind === 'voucher' ? 'Redeemed' : 'CheckedIn');
      expect(row.imageUrl).toBe('/new.jpg');
    });
    it(`${kind}: rejects stale usage status after usage commits first`, async () => {
      const { service, row, transaction, updates } = passFixture(kind);
      const usage = transaction(async () => {
        row.status = kind === 'voucher' ? 'Redeemed' : 'CheckedIn';
      });
      const edit = service.update(1, {
        status: 'Issued',
        imageUrl: '/new.jpg',
      });
      await usage;
      await expect(edit).rejects.toBeInstanceOf(ConflictException);
      expect(updates).toEqual([]);
      await service.update(1, { imageUrl: '/new.jpg' });
      expect(row.status).toBe(kind === 'voucher' ? 'Redeemed' : 'CheckedIn');
    });
    it(`${kind}: blocks direct usage timestamps even on manually issued passes`, async () => {
      const { service } = passFixture(kind, false);
      const data =
        kind === 'voucher'
          ? { redeemedAt: new Date() }
          : { checkedInAt: new Date() };
      await expect(service.update(1, data)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
    it(`${kind}: preserves unique-conflict mapping and emits no success event`, async () => {
      const { service } = passFixture(kind);
      const events = { emit: mock() };
      Object.assign(service, { eventEmitter: events });
      const repository = {
        findOne: async () => ({ id: 1, status: 'Issued', orderItemId: 5 }),
        update: async () => {
          throw Object.assign(new Error('Unique constraint violation'), {
            code: '23505',
          });
        },
      };
      Object.assign(service, {
        repository: {
          manager: {
            transaction: async (
              run: (manager: EntityManager) => Promise<unknown>,
            ) =>
              run({
                getRepository: () => repository,
              } as unknown as EntityManager),
          },
        },
      });
      await expect(
        service.update(1, { code: 'duplicate' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(events.emit).not.toHaveBeenCalled();
    });
  }
});

const rules: CampaignRules = {
  startsAt: '2026-10-01T00:00:00Z',
  paymentPoints: 10,
  usagePoints: 5,
  referralPoints: 20,
  couponIds: [1, 2],
  eventIds: [],
  reward: {
    kind: 'percentage',
    value: 15,
    minimumOrder: 50000,
    maximumDiscount: 25000,
  },
};
describe('campaign rule comparison after activity', () => {
  const reordered = {
    ...rules,
    reward: {
      maximumDiscount: 25000,
      minimumOrder: 50000,
      value: 15,
      kind: 'percentage' as const,
    },
    couponIds: [2, 1, 1],
    startsAt: '2026-10-01T07:00:00+07:00',
  };
  const setup = () => {
    const row = { id: 1, rules, targetPoints: 100, active: true };
    const ledger = {
      countBy: async () => 1,
      createQueryBuilder: () => {
        const q = {
          where: () => q,
          andWhere: () => q,
          getCount: async () => 1,
        };
        return q;
      },
    };
    const repository = {
      findOne: async () => row,
      save: async (value: object) => value,
    };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === PortalCampaign
          ? repository
          : { ...ledger, countBy: async () => 2 },
    };
    return new PortalCampaignAdminService({
      ...repository,
      manager: { transaction: async (run: any) => run(manager) },
    } as any);
  };
  it('ignores key order, ID set order and timestamp offset', () => {
    expect(campaignRulesEqual(rules, reordered)).toBe(true);
    expect(campaignRulesEqual(rules, { ...rules, paymentPoints: 11 })).toBe(
      false,
    );
    expect(campaignRulesEqual(rules, null)).toBe(false);
  });
  it('allows deactivation with unchanged rules', async () => {
    expect(
      await setup().update(1, { rules: reordered, active: false }),
    ).toMatchObject({ active: false });
  });
  it('rejects actual rule and target changes', async () => {
    await expect(
      setup().update(1, { rules: { ...rules, paymentPoints: 11 } }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      setup().update(1, { targetPoints: 101 }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(setup().update(1, { rules: null })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('create uniqueness columns', () => {
  it.each([
    [CreatePortalVoucherDto, 'code'],
    [CreatePortalTicketDto, 'code'],
    [CreatePortalOrderDto, 'orderNumber'],
  ] as const)('uses the actual entity key', (Dto, key) => {
    const metadata = getMetadataStorage()
      .getTargetValidationMetadatas(Dto, '', false, false)
      .find((item) => item.constraintCls === IsUniqueConstraint);
    expect(metadata?.constraints[1]).toBe(key);
  });
});
