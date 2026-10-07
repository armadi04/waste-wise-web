import { TimeZoneService } from '@/portal/time-zone/time-zone.service';
import { ConflictException } from '@nestjs/common';
import { describe, expect, it, jest } from 'bun:test';
import { Repository } from 'typeorm';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalCouponAdminService } from '../../../../src/portal/admin/portal-admin.service';

const createService = (existingSlugs: Array<string> = []) => {
  const slugs = new Set(existingSlugs);
  const repository = {
    create: jest.fn((dto: Partial<PortalCoupon>) => dto),
    save: jest.fn(async (entity: Partial<PortalCoupon>) => entity),
    createQueryBuilder: jest.fn(() => {
      let slug = '';
      const query = {
        withDeleted: () => query,
        where: (_condition: string, values: { slug: string }) => {
          slug = values.slug;
          return query;
        },
        andWhere: () => query,
        getExists: async () => slugs.has(slug),
      };
      return query;
    }),
  } as unknown as Repository<PortalCoupon>;

  const packageRepo = {
    find: async () => [],
    create: (dto: unknown) => dto,
    save: async (dto: unknown) => dto,
  };
  Object.assign(repository, {
    update: async () => undefined,
    findOneByOrFail: async () => ({ id: 1 }),
    manager: {
      transaction: async (run: (manager: unknown) => Promise<unknown>) =>
        run({
          getRepository: (entity: unknown) =>
            entity === PortalCoupon ? repository : packageRepo,
        }),
    },
  });
  return {
    service: new PortalCouponAdminService(repository, {
      prepare: async (dto: unknown) => dto,
      recordChange: () => undefined,
    } as unknown as TimeZoneService),
    repository,
  };
};

describe('PortalCouponAdminService', () => {
  it('generates a normalized slug from title when slug is omitted', async () => {
    const { service, repository } = createService();

    await service.create({
      title: 'Kopi & Crème',
      expiresAt: new Date('2099-01-01'),
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'kopi-creme' }),
    );
  });

  it('adds a numeric suffix when generated slug already exists', async () => {
    const { service, repository } = createService(['late-night']);

    await service.create({
      title: 'Late Night',
      expiresAt: new Date('2099-01-01'),
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'late-night-2' }),
    );
  });

  it('normalizes a custom slug and rejects an existing one', async () => {
    const { service } = createService(['custom-slug']);

    await expect(
      service.create({ title: 'Custom', slug: 'Custom Slug' }),
    ).rejects.toThrow(ConflictException);
  });
});
