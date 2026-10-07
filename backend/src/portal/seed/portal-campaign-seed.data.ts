import type { PortalCampaign } from '@/portal/campaigns/entities/portal-campaign.entity';

type CampaignSeed = Pick<
  PortalCampaign,
  | 'slug'
  | 'title'
  | 'description'
  | 'rewardLabel'
  | 'imageUrl'
  | 'targetPoints'
  | 'active'
  | 'rules'
>;

const SEED_RULES_START = new Date().toISOString();

export const DEMO_CAMPAIGN_SEEDS: CampaignSeed[] = [
  {
    slug: 'demo-ajak-teman-makan-malam',
    title: '[Demo] Ajak teman makan malam',
    description:
      'Undang teman untuk mencoba pengalaman makan malam bersama. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher makan Rp25.000',
    imageUrl:
      'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 20,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 25000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-jelajah-kuliner-jakarta',
    title: '[Demo] Jelajah kuliner Jakarta',
    description:
      'Coba tiga pengalaman kuliner berbeda di Jakarta. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher diskon 15%',
    imageUrl:
      'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 45,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'percentage',
        value: 15,
        minimumOrder: 0,
        maximumDiscount: 50000,
      },
    },
  },
  {
    slug: 'demo-malam-jazz-bersama',
    title: '[Demo] Malam jazz bersama',
    description:
      'Ajak komunitasmu menikmati pertunjukan jazz lokal. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher tiket Rp50.000',
    imageUrl:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 60,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 50000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-akhir-pekan-rooftop',
    title: '[Demo] Akhir pekan di rooftop',
    description:
      'Jelajahi pilihan rooftop bersama teman di akhir pekan. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher rooftop Rp35.000',
    imageUrl:
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 35,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 35000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-komunitas-komedi',
    title: '[Demo] Tertawa bareng komunitas',
    description:
      'Kenalkan pertunjukan komedi lokal kepada teman baru. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Diskon tiket komedi 20%',
    imageUrl:
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 30,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'percentage',
        value: 20,
        minimumOrder: 0,
        maximumDiscount: 50000,
      },
    },
  },
  {
    slug: 'demo-cinema-after-dark',
    title: '[Demo] Cinema after dark',
    description:
      'Ikuti pengalaman nonton bersama komunitas film. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher nonton Rp20.000',
    imageUrl:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 15,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 20000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-bandung-food-trail',
    title: '[Demo] Bandung food trail',
    description:
      'Jelajahi pilihan makan malam di Bandung bersama teman. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher kuliner Rp40.000',
    imageUrl:
      'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 50,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 40000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-surabaya-live-music',
    title: '[Demo] Surabaya live music',
    description:
      'Dukung pertunjukan musik lokal melalui aktivitas komunitas. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Diskon tiket musik 15%',
    imageUrl:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 40,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'percentage',
        value: 15,
        minimumOrder: 0,
        maximumDiscount: 50000,
      },
    },
  },
  {
    slug: 'demo-bali-sunset-club',
    title: '[Demo] Bali sunset club',
    description:
      'Bagikan inspirasi pengalaman senja untuk komunitasmu. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher pengalaman Rp75.000',
    imageUrl:
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 80,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 75000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-yogyakarta-cultural-night',
    title: '[Demo] Yogyakarta cultural night',
    description:
      'Kenalkan pengalaman seni dan budaya malam di Yogyakarta. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher budaya Rp30.000',
    imageUrl:
      'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 25,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 30000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-makassar-dinner-circle',
    title: '[Demo] Makassar dinner circle',
    description:
      'Bangun lingkaran teman untuk eksplorasi kuliner Makassar. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Diskon makan malam 10%',
    imageUrl:
      'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 20,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'percentage',
        value: 10,
        minimumOrder: 0,
        maximumDiscount: 50000,
      },
    },
  },
  {
    slug: 'demo-medan-coffee-evening',
    title: '[Demo] Medan coffee evening',
    description:
      'Jelajahi pilihan kopi sore dan malam bersama komunitas. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher kopi Rp15.000',
    imageUrl:
      'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 10,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 15000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-birthday-night-out',
    title: '[Demo] Rayakan malam ulang tahun',
    description:
      'Kumpulkan inspirasi perayaan ulang tahun bersama teman. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher perayaan Rp100.000',
    imageUrl:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 100,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 100000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-date-night-discovery',
    title: '[Demo] Temukan date night favorit',
    description:
      'Jelajahi pilihan pengalaman makan malam untuk berdua. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher dinner Rp60.000',
    imageUrl:
      'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 70,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 60000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-weekend-explorer',
    title: '[Demo] Weekend explorer',
    description:
      'Coba ragam pengalaman kuliner, hiburan, dan pertunjukan. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher akhir pekan Rp80.000',
    imageUrl:
      'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 90,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 80000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-local-music-supporters',
    title: '[Demo] Dukung musisi lokal',
    description:
      'Kenalkan pertunjukan musisi lokal kepada lingkaran pertemananmu. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Diskon pertunjukan 25%',
    imageUrl:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 55,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'percentage',
        value: 25,
        minimumOrder: 0,
        maximumDiscount: 50000,
      },
    },
  },
  {
    slug: 'demo-community-table',
    title: '[Demo] Satu meja banyak cerita',
    description:
      'Bangun pengalaman makan bersama komunitas dengan minat serupa. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher grup Rp120.000',
    imageUrl:
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 120,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 120000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-creative-night',
    title: '[Demo] Creative night collective',
    description:
      'Bagikan inspirasi aktivitas kreatif dan pertemuan komunitas. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher workshop Rp45.000',
    imageUrl:
      'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 65,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 45000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-nightlife-passport',
    title: '[Demo] Nightlife passport',
    description:
      'Jelajahi pengalaman malam di beberapa kota bersama komunitas. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher eksplorasi Rp150.000',
    imageUrl:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 150,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 150000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
  {
    slug: 'demo-loyalty-night-journey',
    title: '[Demo] Loyalty night journey',
    description:
      'Bangun kebiasaan menemukan pengalaman malam baru sepanjang perjalananmu. Data simulasi lokal; aktivitas, validasi poin, dan reward ini bukan program promosi nyata.',
    rewardLabel: 'Voucher loyalitas Rp200.000',
    imageUrl:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=85',
    targetPoints: 200,
    active: true,
    rules: {
      startsAt: SEED_RULES_START,
      paymentPoints: 10,
      usagePoints: 5,
      referralPoints: 20,
      couponIds: [],
      eventIds: [],
      reward: {
        kind: 'fixed',
        value: 200000,
        minimumOrder: 0,
        maximumDiscount: null,
      },
    },
  },
];
