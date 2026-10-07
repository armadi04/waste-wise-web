import { useContainer } from 'class-validator';
import { IsUniqueConstraint } from '@/common/validators/is-unique.validator';
import type { DataSource } from 'typeorm';
import {
  CreatePortalVoucherDto,
  CreatePortalTicketDto,
} from '@/portal/admin/dto/admin.dto';
import { describe, expect, it } from 'bun:test';
import { ValidationPipe } from '@nestjs/common';
import { CreatePortalFollowDto as CustomerFollowDto } from '@/portal/customer/dto/follow.dto';
import {
  CreatePortalFollowDto as AdminFollowDto,
  CreatePortalCouponDto,
  UpdatePortalVoucherDto,
  UpdatePortalTicketDto,
} from '@/portal/admin/dto/admin.dto';
import { FOLLOW_TARGET_TYPES } from '@/portal/customer/follow-target';

describe('follow validation contract', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  for (const Dto of [CustomerFollowDto, AdminFollowDto]) {
    it.each(FOLLOW_TARGET_TYPES)(
      `${Dto.name} accepts %s`,
      async (targetType) => {
        const input = {
          userId: 7,
          targetType,
          targetKey: 'cafe',
          targetName: 'Cafe',
          imageUrl: 'https://example.test/photo.jpg',
        };
        expect(
          await pipe.transform(input, { type: 'body', metatype: Dto }),
        ).toMatchObject({ targetType });
      },
    );
    it(`${Dto.name} rejects unsupported types`, async () => {
      await expect(
        pipe.transform(
          {
            userId: 7,
            targetType: 'unknown',
            targetKey: 'cafe',
            targetName: 'Cafe',
            imageUrl: 'https://example.test/photo.jpg',
          },
          { type: 'body', metatype: Dto },
        ),
      ).rejects.toMatchObject({ status: 400 });
    });
  }
  for (const Dto of [UpdatePortalVoucherDto, UpdatePortalTicketDto]) {
    it(`${Dto.name} rejects null for required business fields but accepts omitted fields`, async () => {
      for (const key of ['userId', 'status', 'code'])
        await expect(
          pipe.transform({ [key]: null }, { type: 'body', metatype: Dto }),
        ).rejects.toMatchObject({ status: 400 });
      await expect(
        pipe.transform(
          { imageUrl: '/new.jpg' },
          { type: 'body', metatype: Dto },
        ),
      ).resolves.toMatchObject({ imageUrl: '/new.jpg' });
    });
  }
});

describe('coupon create validation', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  const input = {
    title: 'Coupon',
    merchant: 'Cafe',
    city: 'Jakarta',
    location: 'Cafe',
    category: 'Food',
    price: 1000,
    stockTotal: 5,
    stockRemaining: 5,
    imageUrl: 'https://example.test/photo.jpg',
    description: '',
    benefits: '',
    terms: '',
    redemption: '',
    expiresAt: '2027-01-01T00:00:00Z',
    images: [{ url: 'https://example.test/photo.jpg', alt: 'Coupon' }],
    packages: [
      {
        name: 'Dinner',
        benefits: 'Meal',
        price: 1000,
        stockTotal: 5,
        active: true,
      },
    ],
  };
  it('accepts a complete create payload and transforms expiry', async () => {
    const dto = await pipe.transform(input, {
      type: 'body',
      metatype: CreatePortalCouponDto,
    });
    expect(dto.expiresAt).toBeInstanceOf(Date);
    expect(dto.packages[0].stockTotal).toBe(5);
  });
  it('rejects missing summaries and malformed nested package fields', async () => {
    for (const key of ['price', 'stockTotal', 'stockRemaining', 'imageUrl']) {
      await expect(
        pipe.transform(
          { ...input, [key]: undefined },
          { type: 'body', metatype: CreatePortalCouponDto },
        ),
      ).rejects.toMatchObject({ status: 400 });
    }
    await expect(
      pipe.transform(
        { ...input, packages: [{ ...input.packages[0], stockTotal: -1 }] },
        { type: 'body', metatype: CreatePortalCouponDto },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('pass create validation with uniqueness DI', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true });
  for (const [Dto, input] of [
    [
      CreatePortalVoucherDto,
      {
        userId: 7,
        couponId: 9,
        code: 'V-NEW',
        status: 'Issued',
        expiresAt: '2027-01-01T00:00:00Z',
        imageUrl: '/photo.jpg',
      },
    ],
    [
      CreatePortalTicketDto,
      {
        userId: 7,
        eventId: 9,
        ticketTypeId: 10,
        code: 'T-NEW',
        attendee: 'Customer',
        status: 'Issued',
        imageUrl: '/photo.jpg',
      },
    ],
  ] as const) {
    it(`${Dto.name} accepts new codes and rejects duplicates with 400`, async () => {
      let duplicate = false;
      const queries: object[] = [];
      const constraint = new IsUniqueConstraint({
        getRepository: () => ({
          countBy: async (where: object) => {
            queries.push(where);
            return duplicate ? 1 : 0;
          },
        }),
      } as unknown as DataSource);
      useContainer(
        {
          get: (type: unknown) => {
            if (type === IsUniqueConstraint) return constraint;
            throw new Error('Use default validator container');
          },
        },
        { fallbackOnErrors: true },
      );
      try {
        await expect(
          pipe.transform(input, { type: 'body', metatype: Dto }),
        ).resolves.toMatchObject({ code: input.code });
        duplicate = true;
        await expect(
          pipe.transform(input, { type: 'body', metatype: Dto }),
        ).rejects.toMatchObject({ status: 400 });
        expect(queries).toEqual([{ code: input.code }, { code: input.code }]);
      } finally {
        useContainer(undefined);
      }
    });
  }
});
