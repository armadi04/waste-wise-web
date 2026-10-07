import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, jest } from 'bun:test';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import {
  PortalBroadcastAdminService,
  PortalContentAdminService,
  PortalCouponCategoryAdminService,
} from '../../../../src/portal/admin/portal-admin-catalog.service';
import {
  resolveCity,
  resolveCouponCategory,
} from '@/portal/catalog/catalog-taxonomy';
import { PortalCommerceOutbox } from '@/portal/commerce/entities/portal-commerce-outbox.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import type { PortalBroadcast } from '@/portal/customer/entities/portal-broadcast.entity';
import type { PortalContentEntry } from '@/portal/catalog/entities/portal-content-entry.entity';
import type { PortalCouponCategory } from '@/portal/catalog/entities/portal-coupon-category.entity';
import {
  PORTAL_CONTENT,
  normalizeContentSections,
  portalContentDefinition,
} from '@/portal/catalog/portal-content.registry';
import { PortalCatalogService } from '@/portal/catalog/portal-catalog.service';

const events = {
  emit: jest.fn(),
  emitAsync: jest.fn(async () => []),
} as unknown as EventEmitter2;

describe('portal content registry', () => {
  it('rejects unknown keys and validates key-specific data', () => {
    expect(() => portalContentDefinition('page.unknown')).toThrow(
      BadRequestException,
    );
    const nightWork = PORTAL_CONTENT['page.night-work'];
    expect(() =>
      nightWork.validateData({ externalUrl: 'http://insecure.example' }),
    ).toThrow(BadRequestException);
    expect(
      nightWork.validateData({
        externalUrl: 'https://jobs.example/malam',
        ctaLabel: 'Lihat lowongan',
      }),
    ).toEqual({
      externalUrl: 'https://jobs.example/malam',
      ctaLabel: 'Lihat lowongan',
    });
    expect(() =>
      PORTAL_CONTENT['help.contact'].validateData({ email: 'not-an-email' }),
    ).toThrow(BadRequestException);
    expect(
      PORTAL_CONTENT['help.contact'].validateData({
        whatsapp: '+62 812-3456-7890',
      }),
    ).toEqual({ email: '', whatsapp: '+6281234567890', hours: '' });
  });

  it('requires headings where the page needs them and caps section count', () => {
    const terms = portalContentDefinition('page.terms');
    expect(() => normalizeContentSections(terms, [{ body: 'Text' }])).toThrow(
      BadRequestException,
    );
    expect(
      normalizeContentSections(terms, [
        { heading: 'Hak Pengguna', body: 'Isi' },
      ]),
    ).toEqual([{ id: 'hak-pengguna', heading: 'Hak Pengguna', body: 'Isi' }]);
    expect(() =>
      normalizeContentSections(portalContentDefinition('status.notice'), [
        { body: 'x' },
      ]),
    ).toThrow(BadRequestException);
  });
});

describe('catalog taxonomy resolution', () => {
  const manager = (row: object | null) =>
    ({
      getRepository: () => ({ findOneBy: async () => row }),
    }) as unknown as EntityManager;

  it('returns the curated category and canonical city name', async () => {
    expect(
      await resolveCouponCategory(manager({ id: 3, name: 'Musik' }), 'musik'),
    ).toEqual({ id: 3, name: 'Musik' });
    expect(await resolveCity(manager({ name: 'Jakarta' }), ' jakarta ')).toBe(
      'Jakarta',
    );
  });

  it('rejects unknown or blank values', async () => {
    await expect(
      resolveCouponCategory(manager(null), 'Baru'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(resolveCity(manager(null), '')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('PortalCouponCategoryAdminService', () => {
  const setup = (usage = 0) => {
    const current = {
      id: 4,
      name: 'Musik',
      slug: 'musik',
    } as PortalCouponCategory;
    const renamed = jest.fn();
    const couponQuery = {
      update: () => couponQuery,
      set: (values: object) => {
        renamed(values);
        return couponQuery;
      },
      where: () => couponQuery,
      execute: async () => undefined,
    };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === PortalCoupon
          ? {
              createQueryBuilder: () => couponQuery,
              countBy: async () => usage,
            }
          : repository,
      transaction: async (run: (m: unknown) => Promise<unknown>) =>
        run(manager),
    };
    const repository = {
      target: 'PortalCouponCategory',
      manager,
      exists: async () => false,
      findOne: async () => current,
      findOneBy: async () => current,
      merge: (row: object, changes: object) => Object.assign(row, changes),
      save: async (row: object) => row,
      softRemove: async () => undefined,
    } as unknown as Repository<PortalCouponCategory>;
    return {
      service: new PortalCouponCategoryAdminService(repository),
      renamed,
    };
  };

  it('rewrites coupon category text when a category is renamed', async () => {
    const { service, renamed } = setup();
    expect(await service.update(4, { name: 'Musik live' })).toMatchObject({
      name: 'Musik live',
    });
    expect(renamed).toHaveBeenCalledWith({ category: 'Musik live' });
  });

  it('refuses to delete a category coupons still use', async () => {
    await expect(setup(2).service.remove(4)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('portal content', () => {
  it('saves validated content with the editor id and audits it through the outbox', async () => {
    const outbox: Array<{
      operationKey: string;
      eventName: string;
      payload: object;
    }> = [];
    const entries = {
      findOne: async () => null,
      create: (row: object) => ({ ...row }),
      save: async (row: object) => ({ ...row, updatedAt: new Date() }),
    };
    const outboxRepo = {
      find: async () => [],
      findOneBy: async () => null,
      create: (row: (typeof outbox)[number]) => row,
      save: async (row: (typeof outbox)[number]) => outbox.push(row),
    };
    const dataSource = {
      transaction: async (run: (manager: unknown) => Promise<unknown>) =>
        run({
          getRepository: (entity: unknown) =>
            entity === PortalCommerceOutbox ? outboxRepo : entries,
        }),
    } as unknown as DataSource;
    const service = new PortalContentAdminService(
      entries as unknown as Repository<PortalContentEntry>,
      dataSource,
      events,
    );
    const saved = await service.save(
      'help.contact',
      {
        title: 'Hubungi kami',
        published: true,
        data: { email: 'cs@kuponmalam.test' },
      },
      9,
    );
    expect(saved).toMatchObject({
      key: 'help.contact',
      published: true,
      saved: true,
      data: { email: 'cs@kuponmalam.test', whatsapp: '', hours: '' },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toMatchObject({
      eventName: 'audit.record',
      payload: {
        action: 'portal.content_update',
        actorId: 9,
        subjectId: 'help.contact',
      },
    });
  });

  it('serves only published, registered keys publicly', async () => {
    const service = Object.create(
      PortalCatalogService.prototype,
    ) as PortalCatalogService;
    Object.assign(service, {
      dataSource: { getRepository: () => ({ findOneBy: async () => null }) },
    });
    await expect(service.getContent('page.terms')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.getContent('../secret')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('PortalBroadcastAdminService', () => {
  it('returns the original broadcast when the idempotency key is replayed', async () => {
    const existing = {
      id: 1,
      operationKey: 'admin:key-00001',
    } as PortalBroadcast;
    const transaction = jest.fn();
    const service = new PortalBroadcastAdminService(
      {
        findOneBy: async () => existing,
      } as unknown as Repository<PortalBroadcast>,
      { transaction } as unknown as DataSource,
      events,
    );
    expect(
      await service.send(
        {
          title: 'Promo',
          message: 'Halo',
          audience: 'all',
          idempotencyKey: 'key-00001',
        },
        1,
      ),
    ).toBe(existing);
    expect(transaction).not.toHaveBeenCalled();
  });
});
