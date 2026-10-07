import { describe, expect, it, jest } from 'bun:test';
import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { PortalCouponCategoryAdminService } from '@/portal/admin/portal-admin-catalog.service';
import { PortalCustomerService } from '@/portal/customer/portal-customer.service';
import type { PortalCouponCategory } from '@/portal/catalog/entities/portal-coupon-category.entity';

describe('archived taxonomy names', () => {
  it('restores a soft-deleted category when it is created again', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 5,
        name: 'Musik',
        slug: 'musik',
        deletedAt: new Date('2026-09-01T00:00:00Z'),
      }),
      restore: jest.fn().mockResolvedValue({}),
      exists: jest.fn().mockResolvedValue(false),
    };
    const service = new PortalCouponCategoryAdminService(
      repository as unknown as Repository<PortalCouponCategory>,
    );
    const update = jest
      .spyOn(service, 'update')
      .mockResolvedValue({ id: 5 } as PortalCouponCategory);

    await service.create({ name: ' Musik ', label: 'Nonton' });

    expect(repository.restore).toHaveBeenCalledWith(5);
    expect(update).toHaveBeenCalledWith(5, {
      active: true,
      name: 'Musik',
      label: 'Nonton',
    });
  });
});

describe('profile city', () => {
  const serviceWith = (city: { name: string } | null) => {
    const update = jest.fn((_id: number, dto: unknown) =>
      Promise.resolve({ id: 7, ...(dto as object) }),
    );
    const service = Object.assign(
      Object.create(PortalCustomerService.prototype),
      {
        usersService: { update },
        dataSource: {
          manager: {
            getRepository: () => ({ findOneBy: () => Promise.resolve(city) }),
          },
        },
        serializeProfile: (user: unknown) => user,
      },
    ) as PortalCustomerService;
    return { service, update };
  };

  it('stores a new city with its curated name', async () => {
    const { service, update } = serviceWith({ name: 'Bandung' });
    await service.updateProfile(7, { preferredCity: 'bandung' });
    expect(update).toHaveBeenCalledWith(7, { preferredCity: 'Bandung' });
  });

  it('refuses a city that is not curated', async () => {
    const { service, update } = serviceWith(null);
    await expect(
      service.updateProfile(7, { preferredCity: 'Atlantis' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('leaves the city untouched when the field is blank or absent', async () => {
    const { service, update } = serviceWith(null);
    await service.updateProfile(7, { preferredCity: '  ', fullname: 'Rani' });
    expect(update).toHaveBeenCalledWith(7, { fullname: 'Rani' });
  });
});
