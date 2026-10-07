import { timeZoneLabel } from '@/common/utils/business-time';
import type { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import type { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';

export type DemoEventSeed = {
  event: Pick<
    PortalEvent,
    | 'slug'
    | 'title'
    | 'type'
    | 'city'
    | 'timeZone'
    | 'startsAt'
    | 'dateLabel'
    | 'monthLabel'
    | 'dayLabel'
    | 'timeLabel'
    | 'venue'
    | 'basePrice'
    | 'statusLabel'
    | 'imageUrl'
    | 'description'
    | 'active'
  >;
  tickets: Array<
    Pick<
      PortalEventTicket,
      | 'name'
      | 'description'
      | 'price'
      | 'stockTotal'
      | 'stockRemaining'
      | 'statusLabel'
    >
  >;
  slots: Array<{ offsetMinutes: number; capacity: number; remaining: number }>;
};

// Synthetic local fixtures, not advertised merchant events. Slugs are stable across seed runs.
const definitions = [
  {
    slug: 'demo-rooftop-jazz-afterglow',
    title: 'Rooftop Jazz Afterglow',
    type: 'Jazz & Soul',
    city: 'Jakarta',
    timeZone: 'Asia/Jakarta',
    startsAt: '2026-10-09T19:00:00+07:00',
    venue: 'Skyline Studio, Kuningan',
    basePrice: 175000,
    photo: '1516450360452-9312f5e86fc7',
    description:
      'Trio jazz lokal membawakan lagu soul dan improvisasi dengan suasana rooftop. Tiket mencakup akses pertunjukan dan satu minuman nonalkohol.',
  },
  {
    slug: 'demo-indie-under-the-stars',
    title: 'Indie Under the Stars',
    type: 'Indie Live Concert',
    city: 'Jakarta',
    timeZone: 'Asia/Jakarta',
    startsAt: '2026-10-10T19:30:00+07:00',
    venue: 'Taman Nada, Kemang',
    basePrice: 125000,
    photo: '1514525253161-7a46d19cd819',
    description:
      'Tiga band indie tampil bergantian di panggung taman terbuka. Area berdiri, food stall, dan sesi temu komunitas tersedia selama acara.',
  },
  {
    slug: 'demo-midnight-electronic-lab',
    title: 'Midnight Electronic Lab',
    type: 'Electronic DJ Set',
    city: 'Jakarta',
    timeZone: 'Asia/Jakarta',
    startsAt: '2026-10-16T22:00:00+07:00',
    venue: 'Pulse Warehouse, Cilandak',
    basePrice: 225000,
    photo: '1493225457124-a3eb161ffa5f',
    description:
      'Perjalanan house dan techno dari tiga DJ dalam ruang pertunjukan indoor. Tiket reguler mencakup akses dance floor; VIP menyediakan area duduk khusus.',
  },
  {
    slug: 'demo-comedy-friday-night',
    title: 'Comedy Friday Night',
    type: 'Stand-up Comedy',
    city: 'Jakarta',
    timeZone: 'Asia/Jakarta',
    startsAt: '2026-10-23T20:00:00+07:00',
    venue: 'Ruang Tawa, Tebet',
    basePrice: 85000,
    photo: '1528605248644-14dd04022da1',
    description:
      'Lima komika membawakan materi keseharian kota dengan host interaktif. Kursi menggunakan sistem bebas pilih; peserta disarankan datang 30 menit lebih awal.',
  },
  {
    slug: 'demo-cinema-after-dark',
    title: 'Cinema After Dark',
    type: 'Outdoor Film Screening',
    city: 'Jakarta',
    timeZone: 'Asia/Jakarta',
    startsAt: '2026-10-25T18:30:00+07:00',
    venue: 'Layar Taman, Menteng',
    basePrice: 75000,
    photo: '1517457373958-b7bdd4587205',
    description:
      'Pemutaran dua film pendek dan diskusi bersama komunitas sinema. Tiket termasuk popcorn, akses area beanbag, dan sesi diskusi setelah penayangan.',
  },
  {
    slug: 'demo-soul-dining-session',
    title: 'Soul & Dining Session',
    type: 'Dinner & Live Music',
    city: 'Jakarta',
    timeZone: 'Asia/Jakarta',
    startsAt: '2026-10-31T19:00:00+07:00',
    venue: 'Meja Malam Studio, Senopati',
    basePrice: 350000,
    photo: '1414235077428-338989a2e8c0',
    description:
      'Makan malam tiga hidangan dengan pertunjukan soul akustik. Paket termasuk appetizer, main course, dessert, dan mocktail; beri tahu kebutuhan makanan saat reservasi.',
  },
  {
    slug: 'demo-vinyl-listening-club',
    title: 'Vinyl Listening Club',
    type: 'Listening Party',
    city: 'Jakarta',
    timeZone: 'Asia/Jakarta',
    startsAt: '2026-11-06T20:00:00+07:00',
    venue: 'Ruang Putar, Blok M',
    basePrice: 95000,
    photo: '1515003197210-e0cd71810b5f',
    description:
      'Sesi mendengarkan album pilihan dari koleksi vinyl komunitas. Kapasitas terbatas, termasuk diskusi kurator dan satu kopi atau teh.',
  },
  {
    slug: 'demo-city-lights-photowalk',
    title: 'City Lights Photowalk',
    type: 'Photography Workshop',
    city: 'Jakarta',
    timeZone: 'Asia/Jakarta',
    startsAt: '2026-11-07T18:00:00+07:00',
    venue: 'Titik Temu Foto, Kota Tua',
    basePrice: 150000,
    photo: '1517457373958-b7bdd4587205',
    description:
      'Workshop fotografi malam dan jalan kaki bersama mentor selama dua jam. Peserta dapat membawa kamera atau ponsel; tiket termasuk materi digital dan sesi review foto.',
  },
  {
    slug: 'demo-orchestra-city-nocturne',
    title: 'City Nocturne Orchestra',
    type: 'Chamber Orchestra',
    city: 'Jakarta',
    timeZone: 'Asia/Jakarta',
    startsAt: '2026-11-14T19:30:00+07:00',
    venue: 'Auditorium Harmoni, Cikini',
    basePrice: 450000,
    photo: '1516450360452-9312f5e86fc7',
    description:
      'Orkestra kamar membawakan karya klasik dan aransemen soundtrack dalam dua babak. Acara menggunakan tempat duduk; semua kategori demo ini sudah habis untuk menguji tampilan sold-out.',
  },
  {
    slug: 'demo-bandung-acoustic-garden',
    title: 'Bandung Acoustic Garden',
    type: 'Acoustic Showcase',
    city: 'Bandung',
    timeZone: 'Asia/Jakarta',
    startsAt: '2026-10-17T18:30:00+07:00',
    venue: 'Kebun Suara, Dago',
    basePrice: 110000,
    photo: '1528605248644-14dd04022da1',
    description:
      'Musisi akustik tampil di kebun terbuka dengan suasana santai. Tiket termasuk akses pertunjukan dan teh hangat; siapkan jaket untuk malam hari.',
  },
  {
    slug: 'demo-surabaya-improv-stage',
    title: 'Surabaya Improv Stage',
    type: 'Interactive Theatre',
    city: 'Surabaya',
    timeZone: 'Asia/Jakarta',
    startsAt: '2026-10-24T19:00:00+07:00',
    venue: 'Panggung Cerita, Darmo',
    basePrice: 135000,
    photo: '1514525253161-7a46d19cd819',
    description:
      'Pertunjukan teater improvisasi menggunakan ide dari penonton. Tiket reguler mencakup kursi bebas pilih dan sesi tanya jawab bersama pemain.',
  },
  {
    slug: 'demo-bali-sunset-percussion',
    title: 'Bali Sunset Percussion',
    type: 'World Music',
    city: 'Denpasar',
    timeZone: 'Asia/Makassar',
    startsAt: '2026-10-18T17:30:00+08:00',
    venue: 'Paviliun Irama, Sanur',
    basePrice: 200000,
    photo: '1515003197210-e0cd71810b5f',
    description:
      'Kolaborasi perkusi dan musik dunia saat senja di paviliun terbuka. Tiket mencakup pertunjukan dan welcome drink nonalkohol; peserta dapat bergabung pada sesi ritme penutup.',
  },
  {
    slug: 'demo-makassar-creative-night',
    title: 'Makassar Creative Night',
    type: 'Creative Workshop',
    city: 'Makassar',
    timeZone: 'Asia/Makassar',
    startsAt: '2026-10-30T19:00:00+08:00',
    venue: 'Studio Karya, Panakkukang',
    basePrice: 160000,
    photo: '1517457373958-b7bdd4587205',
    description:
      'Workshop membuat poster dan zine bersama komunitas kreatif. Alat dasar, bahan cetak, dan minuman tersedia; peserta membawa pulang hasil karya.',
  },
  {
    slug: 'demo-manado-coastal-sessions',
    title: 'Manado Coastal Sessions',
    type: 'Coastal Live Music',
    city: 'Manado',
    timeZone: 'Asia/Makassar',
    startsAt: '2026-11-13T18:30:00+08:00',
    venue: 'Teras Nada, Sario',
    basePrice: 145000,
    photo: '1528605248644-14dd04022da1',
    description:
      'Pertunjukan pop akustik dan folk di teras outdoor. Tiket termasuk akses panggung, tempat duduk bersama, dan minuman nonalkohol.',
  },
  {
    slug: 'demo-jayapura-cultural-evening',
    title: 'Jayapura Cultural Evening',
    type: 'Culture & Dance',
    city: 'Jayapura',
    timeZone: 'Asia/Jayapura',
    startsAt: '2026-11-21T19:00:00+09:00',
    venue: 'Ruang Budaya, Abepura',
    basePrice: 120000,
    photo: '1514525253161-7a46d19cd819',
    description:
      'Malam pertunjukan tari, musik, dan cerita komunitas dalam ruang serbaguna. Tiket mencakup pertunjukan, booklet digital, dan dialog bersama pengisi acara.',
  },
];

export const DEMO_EVENT_SEEDS: DemoEventSeed[] = definitions.map(
  (definition, index) => {
    const startsAt = new Date(definition.startsAt);
    const timeZone = definition.timeZone;
    const soldOut = index === 8;
    const earlyRemaining = soldOut || index % 4 === 0 ? 0 : 5 + index;
    const regularRemaining = soldOut ? 0 : index % 3 === 0 ? 3 : 30 + index;
    const vipRemaining = soldOut ? 0 : 2 + (index % 7);
    const tickets = [
      {
        name: 'Early Bird',
        description: 'Harga awal, akses pertunjukan utama',
        price: definition.basePrice,
        stockTotal: 20 + index,
        stockRemaining: earlyRemaining,
        statusLabel: earlyRemaining ? 'Tersedia' : 'Habis',
      },
      {
        name: 'Reguler',
        description: 'Akses utama dan seluruh kegiatan reguler',
        price: definition.basePrice + 50000,
        stockTotal: 60 + index * 2,
        stockRemaining: regularRemaining,
        statusLabel:
          regularRemaining <= 3
            ? regularRemaining
              ? 'Sisa 3 tiket'
              : 'Habis'
            : 'Tersedia',
      },
      {
        name: 'VIP',
        description: 'Akses utama, area prioritas dan souvenir demo',
        price: definition.basePrice + 150000,
        stockTotal: 12 + index,
        stockRemaining: vipRemaining,
        statusLabel: vipRemaining ? 'Tersedia' : 'Habis',
      },
    ];
    return {
      event: {
        slug: definition.slug,
        title: `[Demo] ${definition.title}`,
        type: definition.type,
        city: definition.city,
        timeZone,
        startsAt,
        dateLabel: new Intl.DateTimeFormat('id-ID', {
          timeZone,
          day: '2-digit',
        }).format(startsAt),
        monthLabel: new Intl.DateTimeFormat('id-ID', {
          timeZone,
          month: 'short',
        })
          .format(startsAt)
          .toUpperCase(),
        dayLabel: new Intl.DateTimeFormat('id-ID', {
          timeZone,
          weekday: 'long',
        }).format(startsAt),
        timeLabel: `${new Intl.DateTimeFormat('id-ID', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(startsAt)} ${timeZoneLabel(timeZone)}`,
        venue: definition.venue,
        basePrice: definition.basePrice,
        statusLabel: soldOut
          ? 'Tiket habis'
          : `Sisa ${earlyRemaining + regularRemaining + vipRemaining} tiket`,
        imageUrl: `https://images.unsplash.com/photo-${definition.photo}?auto=format&fit=crop&w=1200&q=85`,
        description: `${definition.description}\n\nAcara, venue, harga, fasilitas, dan stok merupakan data simulasi untuk development, bukan jadwal atau penawaran resmi. Pintu dibuka 30 menit sebelum acara; tunjukkan tiket digital saat masuk.`,
        active: true,
      },
      tickets,
      slots: [
        {
          offsetMinutes: -30,
          capacity: 12 + index,
          remaining: soldOut || index % 4 === 0 ? 0 : 8 + index,
        },
        {
          offsetMinutes: 30,
          capacity: 20 + index,
          remaining: soldOut ? 0 : 14 + index,
        },
      ],
    };
  },
);
