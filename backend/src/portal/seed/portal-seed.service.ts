import { Injectable } from '@nestjs/common';
import {
  ensureCouponCategory,
  syncCatalogTaxonomy,
} from '@/portal/catalog/catalog-taxonomy';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from '@/notifications/entities/notification.entity';
import { Role } from '@/roles/entities/role.entity';
import { RegisterMethodEnum } from '@/users/register-method.enum';
import { User } from '@/users/entities/user.entity';
import { PortalBundle } from '@/portal/catalog/entities/portal-bundle.entity';
import { PortalCampaignProgress } from '@/portal/campaigns/entities/portal-campaign-progress.entity';
import { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';
import { PortalCouponPackage } from '@/portal/catalog/entities/portal-coupon-package.entity';
import { packageSnapshot } from '@/portal/catalog/coupon-packages';
import { PortalCoupon } from '@/portal/catalog/entities/portal-coupon.entity';
import { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalFaq } from '@/portal/catalog/entities/portal-faq.entity';
import { PortalFollow } from '@/portal/customer/entities/portal-follow.entity';
import { PortalOrderItem } from '@/portal/commerce/entities/portal-order-item.entity';
import { PortalOrder } from '@/portal/commerce/entities/portal-order.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { PortalReview } from '@/portal/reviews/entities/portal-review.entity';
import { PortalSavedOffer } from '@/portal/customer/entities/portal-saved-offer.entity';
import { PortalGift } from '@/portal/gifts/entities/portal-gift.entity';
import { PortalWallet } from '@/portal/commerce/entities/portal-wallet.entity';
import { PortalWalletTransaction } from '@/portal/commerce/entities/portal-wallet-transaction.entity';
import { PortalPromoCode } from '@/portal/commerce/entities/portal-promo-code.entity';
import { PortalBookingSlot } from '@/portal/bookings/entities/portal-booking-slot.entity';
import { DEMO_EVENT_SEEDS } from '@/portal/seed/portal-event-seed.data';
import { PortalCampaignLedger } from '@/portal/campaigns/entities/portal-campaign-ledger.entity';
import { DEMO_CAMPAIGN_SEEDS } from '@/portal/seed/portal-campaign-seed.data';

const assets = {
  dining:
    'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85',
  concert:
    'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=85',
  rooftop:
    'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=85',
  crowd:
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85',
  city: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=85',
};

@Injectable()
export class PortalSeedService {
  constructor(
    @InjectRepository(PortalCoupon)
    private readonly coupons: Repository<PortalCoupon>,
    @InjectRepository(PortalEvent)
    private readonly events: Repository<PortalEvent>,
    @InjectRepository(PortalEventTicket)
    private readonly tickets: Repository<PortalEventTicket>,
    @InjectRepository(PortalBundle)
    private readonly bundles: Repository<PortalBundle>,
    @InjectRepository(PortalCampaign)
    private readonly campaigns: Repository<PortalCampaign>,
    @InjectRepository(PortalFaq) private readonly faqs: Repository<PortalFaq>,
    @InjectRepository(PortalVoucher)
    private readonly vouchers: Repository<PortalVoucher>,
    @InjectRepository(PortalTicket)
    private readonly portalTickets: Repository<PortalTicket>,
    @InjectRepository(PortalOrder)
    private readonly orders: Repository<PortalOrder>,
    @InjectRepository(PortalOrderItem)
    private readonly orderItems: Repository<PortalOrderItem>,
    @InjectRepository(PortalFollow)
    private readonly follows: Repository<PortalFollow>,
    @InjectRepository(PortalCampaignProgress)
    private readonly progress: Repository<PortalCampaignProgress>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(PortalReview)
    private readonly reviews: Repository<PortalReview>,
    @InjectRepository(PortalSavedOffer)
    private readonly savedOffers: Repository<PortalSavedOffer>,
    @InjectRepository(PortalGift)
    private readonly gifts: Repository<PortalGift>,
    @InjectRepository(PortalWallet)
    private readonly wallets: Repository<PortalWallet>,
    @InjectRepository(PortalWalletTransaction)
    private readonly walletTransactions: Repository<PortalWalletTransaction>,
    @InjectRepository(PortalPromoCode)
    private readonly promoCodes: Repository<PortalPromoCode>,
    @InjectRepository(PortalBookingSlot)
    private readonly bookingSlots: Repository<PortalBookingSlot>,
  ) {}

  async seed() {
    const coupons = await this.seedCoupons();
    const packages = this.coupons.manager.getRepository(PortalCouponPackage);
    for (const coupon of coupons) {
      if (!(await packages.existsBy({ couponId: coupon.id }))) {
        await packages.save(
          packages.create({
            couponId: coupon.id,
            name: coupon.title,
            benefits: coupon.benefits,
            price: coupon.price,
            oldPrice: coupon.oldPrice,
            stockTotal: coupon.stockTotal,
            stockRemaining: coupon.stockRemaining,
            position: 0,
            active: true,
            isDefault: true,
          }),
        );
      }
    }
    if (process.env.NODE_ENV !== 'test') {
      await this.seedCouponReviews();
    }
    const events = await this.seedEvents();
    await syncCatalogTaxonomy(this.coupons.manager);
    await this.seedTickets(events);
    await this.seedBookingSlots(events);
    if (process.env.NODE_ENV !== 'test') await this.seedEventReviews(events);
    await this.seedPromoCodes();
    await this.seedBundles();
    const campaign = await this.seedCampaign();
    await this.seedFaqs();

    const email =
      process.env.NODE_ENV === 'test'
        ? undefined
        : process.env.PORTAL_SEED_EMAIL?.trim().toLowerCase();
    if (email)
      await this.seedDemoAccount(email, coupons[0], events[0], campaign);
  }

  private async seedCouponReviews() {
    const coupons = await this.coupons.find();
    const comments = [
      '[Demo] Pengalaman cukup baik, pelayanan masih bisa ditingkatkan.',
      '[Demo] Paket sesuai deskripsi dan mudah digunakan.',
      '[Demo] Tempat nyaman dan penawaran menarik.',
    ];
    for (let index = 0; index < comments.length; index++) {
      const email = `coupon-review-${index + 1}@example.com`;
      let user = await this.users.findOneBy({ email });
      if (!user) {
        user = await this.users.save(
          this.users.create({
            email,
            fullname: `Pengulas Demo ${index + 1}`,
            password: await bcrypt.hash(randomUUID(), 10),
            registerMethod: RegisterMethodEnum.SEEDER,
            preferredCity: 'Jakarta',
            notificationsEnabled: false,
          }),
        );
      }
      for (const coupon of coupons) {
        if (
          await this.reviews.findOneBy({
            userId: user.id,
            targetType: 'coupon',
            targetKey: coupon.slug,
          })
        ) {
          continue;
        }
        await this.reviews.save(
          this.reviews.create({
            userId: user.id,
            targetType: 'coupon',
            targetKey: coupon.slug,
            authorName: user.fullname,
            rating: index === 0 ? randomInt(2, 5) : randomInt(3, 6),
            body: comments[index],
            verified: false,
            merchantReply: null,
          }),
        );
      }
    }
  }

  private async seedCoupons() {
    // Real merchant references; packages and prices are development-only demos.
    const demoCoupons = [
      {
        slug: 'demo-henshin-nikkei-dinner',
        title: '[Demo] Nikkei Dinner & Skyline Mocktails',
        merchant: 'Henshin, The Westin Jakarta',
        location: 'The Westin Jakarta, Kuningan, Jakarta Selatan',
        category: 'Kuliner malam',
        price: 480000,
        oldPrice: 600000,
        expiresAt: new Date('2026-12-01T17:00:00.000Z'),
        stockTotal: 16,
        imageUrl:
          'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85',
        description:
          'Henshin menghadirkan masakan Nikkei, perpaduan cita rasa Jepang dan Peru, di lantai atas The Westin Jakarta. Paket demo ini menggambarkan makan malam dengan pemandangan kota; harga dan menu paket merupakan simulasi, bukan promo resmi merchant.',
        benefits:
          'Simulasi paket untuk 1 orang: appetizer, main course, dessert, dan 1 mocktail.',
      },
      {
        slug: 'demo-paulaner-bavarian-sharing',
        title: '[Demo] Bavarian Sharing Platter untuk Berdua',
        merchant: 'Paulaner Brauhaus Jakarta',
        location: 'Grand Indonesia, Thamrin, Jakarta Pusat',
        category: 'Kuliner malam',
        price: 320000,
        oldPrice: 400000,
        expiresAt: new Date('2026-11-16T17:00:00.000Z'),
        stockTotal: 24,
        imageUrl:
          'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=1200&q=85',
        description:
          'Paulaner Brauhaus Jakarta dikenal dengan hidangan Bavaria dan bir racikan rumah. Paket berbagi ini dibuat untuk menguji pengalaman katalog dan voucher; harga dan isi paket merupakan simulasi, bukan promo resmi merchant.',
        benefits:
          'Simulasi paket untuk 2 orang: sharing platter gaya Bavaria dan 2 minuman pilihan.',
      },
      {
        slug: 'demo-union-cake-coffee',
        title: '[Demo] Cake & Coffee untuk Dua Orang',
        merchant: 'UNION Plaza Senayan',
        location: 'Plaza Senayan, Jakarta Selatan',
        category: 'Kuliner malam',
        price: 144000,
        oldPrice: 180000,
        expiresAt: new Date('2026-12-16T17:00:00.000Z'),
        stockTotal: 40,
        imageUrl:
          'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=85',
        description:
          'UNION merupakan brasserie, bakery, dan bar dari The Union Group. Paket dessert dan kopi untuk berdua ini merupakan konten demo; harga serta pilihan kue bukan promo resmi merchant.',
        benefits:
          'Simulasi paket untuk 2 orang: 2 potong cake dan 2 kopi atau teh.',
      },
      {
        slug: 'demo-cork-screw-dinner',
        title: '[Demo] Dinner & Wine Pairing di Thamrin',
        merchant: 'Cork & Screw Plaza Indonesia',
        location: 'Plaza Indonesia, Thamrin, Jakarta Pusat',
        category: 'Kuliner malam',
        price: 375000,
        oldPrice: 500000,
        expiresAt: new Date('2026-12-01T17:00:00.000Z'),
        stockTotal: 18,
        imageUrl:
          'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=85',
        description:
          'Cork & Screw memadukan restoran dan wine shop dengan hidangan Eropa serta Asia. Paket dinner ini digunakan untuk demo katalog; harga, pairing, dan stok merupakan simulasi, bukan promo resmi merchant.',
        benefits:
          'Simulasi paket untuk 1 orang: main course, appetizer, dan 1 gelas wine atau mocktail.',
      },
      {
        slug: 'demo-loewy-bistro-dinner',
        title: '[Demo] Bistro Dinner & Mocktail di Kuningan',
        merchant: 'Loewy',
        location: 'Oakwood Premier Cozmo, Mega Kuningan, Jakarta Selatan',
        category: 'Kuliner malam',
        price: 210000,
        oldPrice: 280000,
        expiresAt: new Date('2026-11-21T17:00:00.000Z'),
        stockTotal: 30,
        imageUrl:
          'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=85',
        description:
          'Loewy merupakan bistro dan bar di Mega Kuningan dengan menu klasik serta suasana santai. Paket makan malam ini merupakan simulasi untuk development, bukan promo resmi merchant.',
        benefits:
          'Simulasi paket untuk 1 orang: burger atau main course pilihan, side dish, dan 1 mocktail.',
      },
      {
        slug: 'demo-bistecca-steak-date',
        title: '[Demo] Steak Dinner Date untuk Berdua',
        merchant: 'Bistecca SCBD',
        location: '18 Parc Place, SCBD, Jakarta Selatan',
        category: 'Kuliner malam',
        price: 720000,
        oldPrice: 900000,
        expiresAt: new Date('2027-01-01T17:00:00.000Z'),
        stockTotal: 12,
        imageUrl:
          'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1200&q=85',
        description:
          'Bistecca terinspirasi steakhouse New York dan ristoranti Florence. Paket dinner berdua ini merupakan konten demo; harga, potongan steak, dan benefit bukan promo resmi merchant.',
        benefits:
          'Simulasi paket untuk 2 orang: steak untuk berbagi, 2 side dish, dessert, dan 2 minuman nonalkohol.',
      },
    ];
    // Fictional merchants so the Musik and Venue lanes have development data.
    const demoLaneCoupons = [
      {
        slug: 'demo-live-jazz-session',
        title: '[Demo] Live Jazz Session & Welcome Drink',
        merchant: '[Demo] Ruang Jazz Senopati',
        location: 'Senopati, Jakarta Selatan',
        category: 'Musik',
        price: 150000,
        oldPrice: 200000,
        expiresAt: new Date('2026-12-20T17:00:00.000Z'),
        stockTotal: 30,
        imageUrl: assets.concert,
        description:
          'Merchant fiktif untuk development. Paket menonton sesi jazz akustik dengan satu minuman sambutan; jadwal, harga, dan stok merupakan simulasi.',
        benefits:
          'Simulasi paket untuk 1 orang: akses live session dan 1 welcome drink.',
      },
      {
        slug: 'demo-indie-gig-night',
        title: '[Demo] Indie Gig Night Pass',
        merchant: '[Demo] Panggung Kemang',
        location: 'Kemang, Jakarta Selatan',
        category: 'Musik',
        price: 120000,
        oldPrice: 175000,
        expiresAt: new Date('2027-01-10T17:00:00.000Z'),
        stockTotal: 50,
        imageUrl: assets.crowd,
        description:
          'Merchant fiktif untuk development. Pass malam untuk tiga band indie lokal; lineup, harga, dan stok merupakan simulasi.',
        benefits:
          'Simulasi paket untuk 1 orang: akses gig night dan 1 soft drink.',
      },
      {
        slug: 'demo-rooftop-lounge-table',
        title: '[Demo] Rooftop Lounge Table untuk Berempat',
        merchant: '[Demo] Atap Lounge Sudirman',
        location: 'Sudirman, Jakarta Pusat',
        category: 'Venue',
        price: 600000,
        oldPrice: 850000,
        expiresAt: new Date('2026-12-31T17:00:00.000Z'),
        stockTotal: 10,
        imageUrl: assets.rooftop,
        description:
          'Merchant fiktif untuk development. Reservasi meja rooftop dengan minimum spend; harga, kapasitas, dan stok merupakan simulasi.',
        benefits:
          'Simulasi paket untuk 4 orang: meja rooftop 3 jam dan sharing snack platter.',
      },
      {
        slug: 'demo-private-karaoke-room',
        title: '[Demo] Private Karaoke Room 2 Jam',
        merchant: '[Demo] Suara Kota Kelapa Gading',
        location: 'Kelapa Gading, Jakarta Utara',
        category: 'Venue',
        price: 240000,
        oldPrice: 320000,
        expiresAt: new Date('2027-01-31T17:00:00.000Z'),
        stockTotal: 20,
        imageUrl: assets.city,
        description:
          'Merchant fiktif untuk development. Ruang karaoke privat untuk kelompok kecil; harga, durasi, dan stok merupakan simulasi.',
        benefits:
          'Simulasi paket untuk 6 orang: ruang karaoke 2 jam dan 1 pitcher minuman.',
      },
    ];
    const data = [
      {
        slug: 'late-night-tasting-cocktails',
        title: 'Late Night Tasting & Cocktails',
        merchant: 'Skye Bar & Dining',
        city: 'Jakarta',
        location: 'Thamrin, Jakarta Pusat',
        category: 'Kuliner malam',
        price: 350000,
        oldPrice: 550000,
        discount: '−36%',
        expiresAt: new Date('2026-09-30T16:59:59.000Z'),
        stockTotal: 12,
        stockRemaining: 12,
        imageUrl: assets.rooftop,
        description:
          'Paket tasting dan cocktails untuk malam yang lebih santai.',
        benefits: 'Nikmati paket pilihan di merchant.',
        terms: 'Satu voucher berlaku untuk satu transaksi.',
        redemption: 'Tunjukkan voucher aktif saat pembayaran.',
        active: true,
      },
      {
        slug: 'weekend-night-platter-drinks',
        title: 'Weekend Night Platter & Drinks',
        merchant: 'Lucy in the Sky SCBD',
        city: 'Jakarta',
        location: 'SCBD, Jakarta Selatan',
        category: 'Kuliner malam',
        price: 180000,
        oldPrice: 300000,
        discount: '−40%',
        expiresAt: new Date('2026-10-12T16:59:59.000Z'),
        stockTotal: 12,
        stockRemaining: 12,
        imageUrl: assets.dining,
        description: 'Platter dan minuman untuk akhir pekan.',
        benefits: 'Paket platter pilihan.',
        terms: 'Berlaku sesuai jam redeem merchant.',
        redemption: 'Tunjukkan voucher aktif saat pembayaran.',
        active: true,
      },
      {
        slug: 'late-dinner-house-beer',
        title: 'Late Dinner & House Beer Package',
        merchant: 'The Brotherhood',
        city: 'Jakarta',
        location: 'Senopati, Jakarta Selatan',
        category: 'Kuliner malam',
        price: 245000,
        oldPrice: 350000,
        discount: '−30%',
        expiresAt: new Date('2026-09-30T16:59:59.000Z'),
        stockTotal: 5,
        stockRemaining: 5,
        imageUrl: assets.city,
        description: 'Late dinner dan house beer untuk malam bersama teman.',
        benefits: 'Paket dinner pilihan.',
        terms: 'Satu voucher untuk satu transaksi.',
        redemption: 'Tunjukkan voucher aktif saat pembayaran.',
        active: true,
      },
      {
        slug: 'midnight-gastronomy-tapas',
        title: 'Midnight Gastronomy & Tapas',
        merchant: 'Black Owl PIK',
        city: 'Jakarta',
        location: 'Pantai Indah Kapuk',
        category: 'Kuliner malam',
        price: 225000,
        oldPrice: 300000,
        discount: '−25%',
        expiresAt: new Date('2026-10-18T16:59:59.000Z'),
        stockTotal: 20,
        stockRemaining: 20,
        imageUrl: assets.rooftop,
        description: 'Tapas dan pengalaman dining setelah tengah malam.',
        benefits: 'Menu tapas pilihan.',
        terms: 'Berlaku sesuai ketersediaan merchant.',
        redemption: 'Tunjukkan voucher aktif saat pembayaran.',
        active: true,
      },
      ...[...demoCoupons, ...demoLaneCoupons].map((coupon) => ({
        ...coupon,
        city: 'Jakarta',
        stockRemaining: coupon.stockTotal,
        discount: `−${Math.round((1 - coupon.price / coupon.oldPrice) * 100)}%`,
        images: [
          { url: coupon.imageUrl, alt: `Foto ilustrasi untuk ${coupon.title}` },
        ],
        terms:
          'Data demo untuk pengujian KuponMalam. Satu voucher untuk satu paket. Harga, stok, dan manfaat merupakan simulasi. Foto merupakan ilustrasi, bukan foto merchant. Tidak berlaku untuk transaksi atau penukaran di merchant nyata.',
        redemption:
          'Gunakan alur klaim dan voucher pada lingkungan development untuk simulasi. Jangan menunjukkan voucher demo ini untuk pembayaran di merchant nyata.',
        active: true,
      })),
    ];
    // categoryId is required: link each demo coupon to its curated category first.
    const categoryIds = new Map<string, number>();
    for (const name of new Set(data.map((coupon) => coupon.category)))
      categoryIds.set(
        name,
        (await ensureCouponCategory(this.coupons.manager, name)).id,
      );
    return this.saveMany(
      this.coupons,
      data.map((coupon) => ({
        ...coupon,
        categoryId: categoryIds.get(coupon.category),
      })),
      'slug',
    );
  }

  private async seedEvents() {
    const data = [
      {
        slug: 'jakarta-groove-collective-vol-4',
        title: 'Jakarta Groove Collective Vol. 4',
        type: 'Live Jazz & Soul Session',
        dateLabel: '24',
        monthLabel: 'OKT',
        dayLabel: 'Sabtu',
        startsAt: new Date('2026-10-24T12:00:00.000Z'),
        venue: 'Bengkel Space SCBD',
        city: 'Jakarta',
        timeLabel: '19:00 WIB',
        basePrice: 175000,
        statusLabel: 'Tersedia',
        imageUrl: assets.concert,
        description: 'Live jazz dan soul session.',
        active: true,
      },
      {
        slug: 'neon-pulse-midnight-techno',
        title: 'Neon Pulse: Midnight Techno Showcase',
        type: 'International DJ Set',
        dateLabel: '30',
        monthLabel: 'OKT',
        dayLabel: 'Jumat',
        startsAt: new Date('2026-10-30T15:00:00.000Z'),
        venue: 'Colosseum Jakarta',
        city: 'Jakarta',
        timeLabel: '22:00 WIB',
        basePrice: 250000,
        statusLabel: 'Sisa 18 tiket',
        imageUrl: assets.crowd,
        description: 'Midnight techno showcase.',
        active: true,
      },
      {
        slug: 'sound-of-sunset-acoustic',
        title: 'Sound of Sunset Acoustic Session',
        type: 'Intimate Rooftop Showcase',
        dateLabel: '01',
        monthLabel: 'NOV',
        dayLabel: 'Minggu',
        startsAt: new Date('2026-11-01T11:30:00.000Z'),
        venue: 'K22 Fairmont Jakarta',
        city: 'Jakarta',
        timeLabel: '18:30 WIB',
        basePrice: 150000,
        statusLabel: 'Tersedia',
        imageUrl: assets.rooftop,
        description: 'Intimate rooftop acoustic showcase.',
        active: true,
      },
    ];
    return this.saveMany(
      this.events,
      [...data, ...DEMO_EVENT_SEEDS.map((seed) => seed.event)],
      'slug',
    );
  }

  private async seedTickets(events: PortalEvent[]) {
    for (const event of events) {
      const options = DEMO_EVENT_SEEDS.find(
        (seed) => seed.event.slug === event.slug,
      )?.tickets ?? [
        {
          name: 'Early Bird',
          description: 'Stok terbatas',
          price: event.basePrice,
          stockTotal: 20,
          stockRemaining: 20,
          statusLabel: 'Tersedia',
        },
        {
          name: 'Reguler',
          description: 'Akses utama',
          price: event.basePrice + 50000,
          stockTotal: 50,
          stockRemaining: 50,
          statusLabel: 'Tersedia',
        },
        {
          name: 'VIP',
          description: 'Benefit khusus',
          price: event.basePrice + 250000,
          stockTotal: 10,
          stockRemaining: 10,
          statusLabel: 'Tersedia',
        },
      ];
      for (const option of options) {
        const existing = await this.tickets.findOneBy({
          eventId: event.id,
          name: option.name,
        });
        if (!existing)
          await this.tickets.save(
            this.tickets.create({ eventId: event.id, ...option }),
          );
      }
    }
  }

  private async seedBookingSlots(events: PortalEvent[]) {
    for (const event of events) {
      const seed = DEMO_EVENT_SEEDS.find(
        (item) => item.event.slug === event.slug,
      );
      const options = seed?.slots ?? [
        { offsetMinutes: -30, capacity: 20, remaining: 20 },
      ];
      for (const option of options) {
        const startsAt = new Date(
          event.startsAt.getTime() + option.offsetMinutes * 60 * 1000,
        );
        const endsAt = new Date(
          startsAt.getTime() + (seed ? 60 : 90) * 60 * 1000,
        );
        const existing = await this.bookingSlots.findOneBy({
          eventId: event.id,
          startsAt,
        });
        if (!existing)
          await this.bookingSlots.save(
            this.bookingSlots.create({
              eventId: event.id,
              startsAt,
              endsAt,
              capacity: option.capacity,
              remaining: option.remaining,
              status: option.remaining > 0 ? 'Available' : 'Full',
            }),
          );
      }
    }
  }

  private async seedEventReviews(events: PortalEvent[]) {
    for (let index = 0; index < 3; index++) {
      const user = await this.users.findOneBy({
        email: `coupon-review-${index + 1}@example.com`,
      });
      if (!user) continue;
      for (const event of events.filter((item) =>
        DEMO_EVENT_SEEDS.some((seed) => seed.event.slug === item.slug),
      )) {
        const target = {
          userId: user.id,
          targetType: 'event',
          targetKey: event.slug,
        };
        if (await this.reviews.findOneBy(target)) continue;
        await this.reviews.save(
          this.reviews.create({
            ...target,
            authorName: user.fullname,
            rating: index === 0 ? randomInt(2, 5) : randomInt(3, 6),
            body:
              '[Demo] ' +
              [
                'Suasana acara menyenangkan, antrean masuk masih bisa dirapikan.',
                'Pertunjukan menarik dan informasi jadwal mudah dipahami.',
                'Tempat nyaman dan pilihan tiket sesuai kebutuhan.',
              ][index],
            verified: false,
            merchantReply: null,
          }),
        );
      }
    }
  }

  private async seedPromoCodes() {
    const existing = await this.promoCodes.findOneBy({ code: 'NIGHTOWL' });
    if (!existing)
      await this.promoCodes.save(
        this.promoCodes.create({
          code: 'NIGHTOWL',
          kind: 'percentage',
          value: 10,
          minimumOrder: 100000,
          maximumDiscount: 50000,
          usageLimit: 1000,
          usageCount: 0,
          expiresAt: new Date('2026-12-31T16:59:59.000Z'),
          active: true,
        }),
      );
  }

  private async seedBundles() {
    return this.saveMany(
      this.bundles,
      [
        {
          slug: 'dinner-groove-night',
          title: 'Dinner & Groove Night',
          description: 'Satu paket untuk makan malam dan menikmati event.',
          couponSlug: 'late-night-tasting-cocktails',
          eventSlug: 'jakarta-groove-collective-vol-4',
          price: 450000,
          imageUrl: assets.concert,
          active: true,
        },
      ],
      'slug',
    );
  }

  private async seedCampaign() {
    const campaigns = await this.saveMany(
      this.campaigns,
      [
        {
          slug: 'demo',
          title: 'Ajak teman, buka malam yang lebih seru.',
          description:
            'Bagikan campaign dan dapatkan reward setelah aktivitas tervalidasi.',
          rewardLabel: 'Voucher diskon 10%',
          imageUrl: assets.crowd,
          targetPoints: 25,
          active: true,
        },
        ...DEMO_CAMPAIGN_SEEDS,
      ],
      'slug',
    );
    for (const campaign of campaigns) {
      const fixture = DEMO_CAMPAIGN_SEEDS.find(
        (seed) => seed.slug === campaign.slug,
      );
      if (!campaign.rules && fixture?.rules) {
        campaign.rules = fixture.rules;
        await this.campaigns.save(campaign);
      }
    }
    return campaigns[0];
  }

  private async seedFaqs() {
    const data = [
      {
        position: 1,
        question: 'Bagaimana cara klaim kupon?',
        answer:
          'Pilih penawaran, masuk dengan OTP bila diperlukan, lalu tekan Klaim Voucher.',
        active: true,
      },
      {
        position: 2,
        question: 'Apakah GPS wajib digunakan?',
        answer: 'Tidak. Kamu tetap dapat memilih kota secara manual.',
        active: true,
      },
      {
        position: 3,
        question: 'Kapan tiket muncul setelah pembayaran?',
        answer:
          'Status pembayaran perlu diverifikasi sebelum tiket diterbitkan.',
        active: true,
      },
      {
        position: 4,
        question: 'Bagaimana jika QR tidak dapat dipindai?',
        answer: 'Pastikan koneksi tersedia dan buka ulang detail digital.',
        active: true,
      },
    ];
    for (const item of data) {
      const existing = await this.faqs.findOneBy({ question: item.question });
      if (!existing) await this.faqs.save(this.faqs.create(item));
    }
  }

  private async seedDemoAccount(
    email: string,
    coupon: PortalCoupon,
    event: PortalEvent,
    campaign: PortalCampaign,
  ) {
    let role = await this.roles.findOneBy({ name: 'customer' });
    if (!role)
      role = await this.roles.save(
        this.roles.create({
          name: 'customer',
          description: 'KuponMalam portal user',
        }),
      );
    let user = await this.users.findOne({
      where: { email },
      relations: { roles: true },
    });
    if (!user) {
      user = await this.users.save(
        this.users.create({
          email,
          password: await bcrypt.hash(randomUUID(), 10),
          registerMethod: RegisterMethodEnum.SEEDER,
          fullname: process.env.PORTAL_SEED_NAME ?? 'Portal Demo',
          phone: '+62 812 3456 7890',
          preferredCity: 'Jakarta',
          notificationsEnabled: true,
          emailVerifiedAt: new Date(),
          roles: [role],
        }),
      );
    }

    let voucher = await this.vouchers.findOneBy({
      userId: user.id,
      couponId: coupon.id,
    });
    if (!voucher)
      voucher = await this.vouchers.save(
        this.vouchers.create({
          userId: user.id,
          couponId: coupon.id,
          code: 'VCH-DEMO-001',
          status: 'Issued',
          expiresAt: coupon.expiresAt,
          redeemedAt: null,
          imageUrl: coupon.imageUrl,
        }),
      );
    const ticketType = await this.tickets.findOneBy({
      eventId: event.id,
      name: 'Early Bird',
    });
    if (
      ticketType &&
      !(await this.portalTickets.findOneBy({
        userId: user.id,
        eventId: event.id,
      }))
    ) {
      await this.portalTickets.save(
        this.portalTickets.create({
          userId: user.id,
          eventId: event.id,
          ticketTypeId: ticketType.id,
          code: 'TKT-DEMO-001',
          attendee: user.fullname ?? 'Portal Demo',
          status: 'Issued',
          imageUrl: event.imageUrl,
          checkedInAt: null,
        }),
      );
    }
    let order = await this.orders.findOneBy({ orderNumber: 'ORD-DEMO-001' });
    if (!order) {
      order = await this.orders.save(
        this.orders.create({
          userId: user.id,
          orderNumber: 'ORD-DEMO-001',
          idempotencyKey: 'seed-demo-order',
          status: 'Paid',
          kind: 'ticket',
          total: 182500,
          currency: 'IDR',
          title: event.title,
          meta: '24 Okt 2026',
        }),
      );
      await this.orderItems.save(
        this.orderItems.create({
          orderId: order.id,
          productType: 'ticket',
          productId: ticketType?.id ?? 0,
          title: event.title,
          quantity: 1,
          unitPrice: 175000,
        }),
      );
    }
    if (
      !(await this.follows.findOneBy({
        userId: user.id,
        targetType: 'merchant',
        targetKey: 'Skye Bar & Dining',
      }))
    ) {
      await this.follows.save(
        this.follows.create({
          userId: user.id,
          targetType: 'merchant',
          targetKey: 'Skye Bar & Dining',
          targetName: 'Skye Bar & Dining',
          imageUrl: assets.rooftop,
        }),
      );
    }
    if (
      !(await this.progress.findOneBy({
        userId: user.id,
        campaignId: campaign.id,
      }))
    ) {
      await this.progress.save(
        this.progress.create({
          userId: user.id,
          campaignId: campaign.id,
          points: 18,
          targetPoints: campaign.targetPoints,
          status: 'pending',
        }),
      );
    }
    if (
      !(await this.notifications.findOneBy({
        userId: user.id,
        title: 'Pembayaran diterima',
      }))
    ) {
      await this.notifications.save(
        this.notifications.create({
          userId: user.id,
          title: 'Pembayaran diterima',
          message: 'Tiket sedang disiapkan.',
          type: NotificationType.SUCCESS,
          isRead: false,
          link: '/akun/tiket',
        }),
      );
    }
    const existingProgress = await this.progress.findOneBy({
      userId: user.id,
      campaignId: campaign.id,
    });
    const ledger = this.progress.manager.getRepository(PortalCampaignLedger);
    if (
      existingProgress &&
      !(await ledger.findOneBy({
        campaignId: campaign.id,
        userId: user.id,
        sourceKey: 'baseline',
      }))
    ) {
      await ledger.save(
        ledger.create({
          campaignId: campaign.id,
          userId: user.id,
          sourceKey: 'baseline',
          kind: 'baseline',
          points: existingProgress.points,
          orderId: null,
          actorId: null,
          reason: 'Local demo opening balance',
        }),
      );
    }

    await this.seedDemoReview(
      user.id,
      'coupon',
      coupon.slug,
      5,
      'Paket malam terasa premium dan mudah digunakan.',
    );
    await this.seedDemoReview(
      user.id,
      'event',
      event.slug,
      4,
      'Line-up seru dan venue nyaman untuk malam Jakarta.',
    );
    if (
      !(await this.savedOffers.findOneBy({
        userId: user.id,
        targetType: 'coupon',
        targetKey: coupon.slug,
      }))
    ) {
      await this.savedOffers.save(
        this.savedOffers.create({
          userId: user.id,
          targetType: 'coupon',
          targetKey: coupon.slug,
          targetName: coupon.title,
          imageUrl: coupon.imageUrl,
        }),
      );
    }
    if (!(await this.gifts.findOneBy({ code: 'GFT-DEMO-001' })))
      await this.gifts.save(
        this.gifts.create({
          senderUserId: user.id,
          couponId: coupon.id,
          code: 'GFT-DEMO-001',
          recipientName: 'Nadia Demo',
          recipientEmail: 'nadia@example.com',
          message: 'Selamat menikmati malamnya!',
          status: 'Ready',
          expiresAt: coupon.expiresAt,
          imageUrl: coupon.imageUrl,
        }),
      );
    const wallet = await this.wallets.findOneBy({ userId: user.id });
    if (!wallet)
      await this.wallets.save(
        this.wallets.create({
          userId: user.id,
          balance: 35000,
          lifetimeEarned: 35000,
        }),
      );
    if (
      !(await this.walletTransactions.findOneBy({
        description: 'Cashback order demo',
      }))
    )
      await this.walletTransactions.save(
        this.walletTransactions.create({
          userId: user.id,
          type: 'cashback',
          amount: 35000,
          description: 'Cashback order demo',
        }),
      );
    const selectedPackage = await this.coupons.manager
      .getRepository(PortalCouponPackage)
      .findOneBy({ couponId: coupon.id, isDefault: true });
    if (selectedPackage) {
      if (!voucher.packageId)
        await this.vouchers.update(voucher.id, {
          packageId: selectedPackage.id,
          packageSnapshot: packageSnapshot(selectedPackage),
        });
      const gift = await this.gifts.findOneBy({ code: 'GFT-DEMO-001' });
      if (gift && !gift.packageId)
        await this.gifts.update(gift.id, {
          packageId: selectedPackage.id,
          packageSnapshot: packageSnapshot(selectedPackage),
        });
    }
  }

  private async seedDemoReview(
    userId: number,
    targetType: string,
    targetKey: string,
    rating: number,
    body: string,
  ) {
    const existing = await this.reviews.findOneBy({
      userId,
      targetType,
      targetKey,
    });
    if (!existing) {
      await this.reviews.save(
        this.reviews.create({
          userId,
          targetType,
          targetKey,
          authorName: process.env.PORTAL_SEED_NAME ?? 'Portal Demo',
          rating,
          body,
          verified: true,
          merchantReply: null,
        }),
      );
    }
  }

  private async saveMany<T extends { id: number }>(
    repository: Repository<T>,
    items: Array<Partial<T>>,
    key: keyof T,
  ) {
    const result: T[] = [];
    for (const item of items) {
      const existing = await repository.findOneBy({
        [key]: item[key],
      } as never);
      result.push(
        existing ?? (await repository.save(repository.create(item as T))),
      );
    }
    return result;
  }
}
