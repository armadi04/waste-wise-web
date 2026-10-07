import { PortalCommerceService } from '@/portal/commerce/portal-commerce.service';
import { afterEach, describe, expect, it, jest } from 'bun:test';
import { ConflictException } from '@nestjs/common';
import { PortalGiftsService } from '@/portal/gifts/portal-gifts.service';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import { PortalGift } from '@/portal/gifts/entities/portal-gift.entity';

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

function serviceFor(
  coupon: Partial<PortalCoupon>,
  selected: Partial<PortalCouponPackage>,
  { sentToday = 0 } = {},
) {
  const save = jest.fn((value: unknown) => Promise.resolve(value));
  const builder = (result: unknown) => {
    const query = {
      setLock: () => query,
      where: () => query,
      andWhere: () => query,
      getOne: () => Promise.resolve(result),
    };
    return query;
  };
  const manager = {
    getRepository: (entity: unknown) => ({
      createQueryBuilder: () =>
        builder(entity === PortalCoupon ? coupon : selected),
      save,
      create: (value: unknown) => value,
      countBy: () => Promise.resolve(sentToday),
    }),
  };
  const service = Object.assign(Object.create(PortalGiftsService.prototype), {
    dataSource: {
      transaction: (work: (m: typeof manager) => unknown) => work(manager),
    },
    usersService: {
      findOne: () => Promise.resolve({ id: 7, email: 'Sender@Example.test' }),
    },
    campaigns: { lockCommerce: jest.fn() },
  }) as PortalGiftsService;
  return { service, save };
}

function redeemServiceFor(
  gift: Partial<PortalGift>,
  { alreadyHeld = false } = {},
) {
  const save = jest.fn((value: unknown) => Promise.resolve(value));
  const builder = (result: unknown) => {
    const query = {
      setLock: () => query,
      where: () => query,
      getOne: () => Promise.resolve(result),
    };
    return query;
  };
  const manager = {
    getRepository: (entity: unknown) => ({
      createQueryBuilder: () =>
        builder(entity === PortalGift ? gift : { id: 1, active: true }),
      existsBy: () => Promise.resolve(alreadyHeld),
      save,
      create: (value: unknown) => value,
    }),
  };
  const service = Object.assign(Object.create(PortalGiftsService.prototype), {
    dataSource: {
      transaction: (work: (m: typeof manager) => unknown) => work(manager),
    },
    usersService: {
      findOne: () => Promise.resolve({ id: 8, email: 'rani@example.test' }),
    },
    campaigns: { lockCommerce: jest.fn() },
  }) as PortalGiftsService;
  return { service, save };
}

const gift = {
  slug: 'dinner',
  recipientName: 'Rani',
  recipientEmail: 'rani@example.test',
};

describe('gifts', () => {
  it('refuses paid packages because a gift takes stock without an order', async () => {
    const { service, save } = serviceFor(
      { id: 1, expiresAt: future, salesEndsAt: null, validityDays: null },
      { id: 2, price: 125_000, active: true, stockRemaining: 3 },
    );
    await expect(service.createGift(7, gift)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses gifts once the sales window has closed', async () => {
    const { service, save } = serviceFor(
      { id: 1, expiresAt: future, salesEndsAt: past, validityDays: 30 },
      { id: 2, price: 0, active: true, stockRemaining: 3 },
    );
    await expect(service.createGift(7, gift)).rejects.toThrow(
      'Coupon has expired',
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses a gift to your own email, which would be a second free voucher', async () => {
    const { service, save } = serviceFor(
      { id: 1, expiresAt: future, salesEndsAt: null, validityDays: null },
      { id: 2, price: 0, active: true, stockRemaining: 3 },
    );
    await expect(
      service.createGift(7, {
        ...gift,
        recipientEmail: ' sender@example.TEST',
      }),
    ).rejects.toThrow('Gifts cannot be sent to your own email');
    expect(save).not.toHaveBeenCalled();
  });

  it('stops a sender at the daily gift allowance before taking stock', async () => {
    const { service, save } = serviceFor(
      { id: 1, expiresAt: future, salesEndsAt: null, validityDays: null },
      { id: 2, price: 0, active: true, stockRemaining: 3 },
      { sentToday: 5 },
    );
    await expect(service.createGift(7, gift)).rejects.toThrow(
      'Daily gift limit reached',
    );
    expect(save).not.toHaveBeenCalled();
  });

  const readyGift = {
    id: 3,
    code: 'GFT-1',
    senderUserId: 7,
    couponId: 1,
    packageId: 2,
    recipientEmail: 'rani@example.test',
    status: 'Ready',
    expiresAt: future,
  } as Partial<PortalGift>;

  it('refuses redeeming a gift you sent yourself', async () => {
    const { service, save } = redeemServiceFor({
      ...readyGift,
      senderUserId: 8,
    });
    await expect(service.redeemGift(8, 'GFT-1')).rejects.toThrow(
      'You cannot redeem a gift you sent',
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps one voucher per free package when the recipient already has one', async () => {
    const { service, save } = redeemServiceFor(readyGift, {
      alreadyHeld: true,
    });
    await expect(service.redeemGift(8, 'GFT-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(save).not.toHaveBeenCalled();
  });
});

describe('payment methods', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env.NODE_ENV = env.NODE_ENV;
    process.env.PORTAL_PAYMENT_MODE = env.PORTAL_PAYMENT_MODE;
  });

  it('offers VA only while the payment sandbox is enabled', () => {
    const service = Object.create(
      PortalCommerceService.prototype,
    ) as PortalCommerceService;
    process.env.NODE_ENV = 'development';
    process.env.PORTAL_PAYMENT_MODE = 'sandbox';
    expect(service.paymentMethods()).toEqual({ methods: ['va', 'coins'] });
    process.env.NODE_ENV = 'production';
    expect(service.paymentMethods()).toEqual({ methods: ['coins'] });
  });
});
