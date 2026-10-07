import { BadRequestException } from '@nestjs/common';
import { EntityManager, ILike } from 'typeorm';
import { PortalCity } from '@/portal/catalog/entities/portal-city.entity';
import { PortalCouponCategory } from '@/portal/catalog/entities/portal-coupon-category.entity';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';

/** Home lanes the portal shipped with before categories were curated in admin. */
export const CURATED_COUPON_CATEGORIES = [
  {
    name: 'Kuliner malam',
    label: 'Makan',
    blurb: 'Meja malam, porsi besar, harga yang masih masuk akal.',
    icon: 'utensils',
    position: 1,
  },
  {
    name: 'Musik',
    label: 'Nonton',
    blurb: 'Panggung kecil sampai konser besar, semua di satu malam.',
    icon: 'music',
    position: 2,
  },
  {
    name: 'Venue',
    label: 'Nongkrong',
    blurb: 'Tempat duduk lama, lampu rendah, dan teman yang tepat.',
    icon: 'armchair',
    position: 3,
  },
] as const;

export const taxonomySlug = (value: string, maxLength = 80) =>
  value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);

/** Escapes LIKE wildcards so ILike performs a case-insensitive equality match. */
const exactly = (value: string) =>
  ILike(value.trim().replace(/[\\%_]/g, '\\$&'));

/** The active curated category for a coupon's category label. */
export async function resolveCouponCategory(
  manager: EntityManager,
  name: unknown,
) {
  if (typeof name !== 'string' || !name.trim())
    throw new BadRequestException('Coupon category is required');
  const category = await manager
    .getRepository(PortalCouponCategory)
    .findOneBy({ name: exactly(name), active: true });
  if (!category)
    throw new BadRequestException(
      `Unknown coupon category "${name.trim()}". Add it under Portal → Categories first.`,
    );
  return category;
}

/** The canonical name of an active curated city. */
export async function resolveCity(manager: EntityManager, name: unknown) {
  if (typeof name !== 'string' || !name.trim())
    throw new BadRequestException('City is required');
  const city = await manager
    .getRepository(PortalCity)
    .findOneBy({ name: exactly(name), active: true });
  if (!city)
    throw new BadRequestException(
      `Unknown city "${name.trim()}". Add it under Portal → Cities first.`,
    );
  return city.name;
}

async function uniqueSlug(
  exists: (slug: string) => Promise<boolean>,
  name: string,
  fallback: string,
  maxLength: number,
) {
  const base = taxonomySlug(name, maxLength) || fallback;
  let slug = base;
  for (let suffix = 2; await exists(slug); suffix += 1)
    slug = `${base.slice(0, maxLength - String(suffix).length - 1)}-${suffix}`;
  return slug;
}

/** Finds or creates the curated category with this name (development seeding). */
export async function ensureCouponCategory(
  manager: EntityManager,
  name: string,
) {
  const categories = manager.getRepository(PortalCouponCategory);
  const existing = await categories.findOne({
    where: { name: exactly(name) },
    withDeleted: true,
  });
  if (existing) return existing;
  const curated = CURATED_COUPON_CATEGORIES.find(
    (item) => item.name.toLowerCase() === name.trim().toLowerCase(),
  );
  return categories.save(
    categories.create({
      name: name.trim(),
      slug: await uniqueSlug(
        (slug) => categories.exists({ where: { slug }, withDeleted: true }),
        name,
        'category',
        80,
      ),
      label: curated?.label ?? null,
      blurb: curated?.blurb ?? '',
      icon: curated?.icon ?? null,
      position: curated?.position ?? 100,
      featured: Boolean(curated),
    }),
  );
}

/**
 * Seeds curated taxonomy from existing coupon/event text and links coupons to
 * their category. Idempotent; used by the development seeder after catalog data.
 */
export async function syncCatalogTaxonomy(manager: EntityManager) {
  const categories = manager.getRepository(PortalCouponCategory);
  const cities = manager.getRepository(PortalCity);
  const coupons = await manager.getRepository(PortalCoupon).find();
  const events = await manager.getRepository(PortalEvent).find();

  for (const name of new Set(coupons.map((c) => c.category.trim())))
    if (name) await ensureCouponCategory(manager, name);
  for (const coupon of coupons) {
    if (coupon.categoryId || !coupon.category.trim()) continue;
    const category = await categories.findOneBy({
      name: exactly(coupon.category),
    });
    if (category)
      await manager.getRepository(PortalCoupon).update(coupon.id, {
        categoryId: category.id,
        category: category.name,
      });
  }

  const cityNames = new Set(
    [...coupons, ...events].map((record) => record.city.trim()).filter(Boolean),
  );
  for (const name of cityNames) {
    if (
      await cities.findOne({
        where: { name: exactly(name) },
        withDeleted: true,
      })
    )
      continue;
    await cities.save(
      cities.create({
        name,
        slug: await uniqueSlug(
          (slug) => cities.exists({ where: { slug }, withDeleted: true }),
          name,
          'city',
          100,
        ),
      }),
    );
  }
}
