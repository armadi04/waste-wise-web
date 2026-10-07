import { PortalReviewsService } from '@/portal/reviews/portal-reviews.service';
import { describe, expect, it, mock } from 'bun:test';
import { PortalCatalogService } from '@/portal/catalog/portal-catalog.service';

function fixture() {
  const events = [1, 2, 3].map((id) => ({
    id,
    publicId: `e${id}`,
    slug: `e${id}`,
    title: 'Event',
    type: 'Music',
    venue: 'Venue',
    timeZone: 'Asia/Jakarta',
    startsAt: new Date('2026-10-02T12:00:00Z'),
    basePrice: 100,
    imageUrl: '',
    statusLabel: 'wrong stored label',
  }));
  const tickets = [
    {
      publicId: 't1',
      eventId: 1,
      name: 'Regular',
      price: 100,
      stockRemaining: 10,
      statusLabel: 'wrong',
    },
    { publicId: 't2', eventId: 1, name: 'VIP', price: 150, stockRemaining: 1 },
    {
      publicId: 't3',
      eventId: 2,
      name: 'Regular',
      price: 100,
      stockRemaining: 0,
    },
  ];
  const builder: any = {};
  for (const name of ['where', 'andWhere', 'orderBy', 'skip', 'take'])
    builder[name] = () => builder;
  builder.getManyAndCount = async () => [events, events.length];
  const reviewQuery: any = {};
  for (const name of ['select', 'addSelect', 'where', 'andWhere', 'groupBy'])
    reviewQuery[name] = () => reviewQuery;
  const aggregate = mock(async () => [
    {
      targetKey: 'e1',
      rating: '3.7',
      reviewCount: '3',
      verifiedReviewCount: '1',
    },
  ]);
  reviewQuery.getRawMany = aggregate;
  const find = mock(async () => tickets);
  const service = Object.create(
    PortalCatalogService.prototype,
  ) as PortalCatalogService;
  Object.assign(service, {
    eventRepository: {
      createQueryBuilder: () => builder,
      findOneBy: async () => events[0],
    },
    eventTicketRepository: { find },
    reviewRepository: { createQueryBuilder: () => reviewQuery },
  });
  Object.assign(service, {
    reviews: Object.assign(Object.create(PortalReviewsService.prototype), {
      reviewRepository: (service as any).reviewRepository,
    }),
  });
  return { service, find, aggregate, builder, tickets };
}

describe('event catalog availability contract', () => {
  it('loads categories and rating aggregates once for the entire page', async () => {
    const { service, find, aggregate } = fixture();
    const result = await service.listEvents({ page: 1, limit: 24 });
    expect(find).toHaveBeenCalledTimes(1);
    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(result.data[0]).toMatchObject({
      status: 'Tersedia',
      availability: { state: 'available', remaining: 11 },
      reviews: { rating: 3.7, reviewCount: 3, verifiedReviewCount: 1 },
    });
    expect(result.data[0].ticketOptions[0]).toMatchObject({
      status: 'Sisa 10 tiket',
      stock: 10,
      availability: { state: 'limited', remaining: 10 },
    });
    expect(result.data[1]).toMatchObject({
      status: 'Tiket habis',
      availability: { state: 'sold-out', remaining: 0 },
    });
    expect(result.data[2]).toMatchObject({
      status: 'Tiket belum tersedia',
      availability: { state: 'unavailable', remaining: 0 },
      reviews: { rating: null, reviewCount: 0 },
    });
  });

  it('returns matching detail and catalog data from the same stock and review aggregates', async () => {
    const { service, find, tickets } = fixture();
    const catalog = await service.listEvents({ page: 1, limit: 24 });
    find.mockImplementation(async () =>
      tickets.filter((ticket) => ticket.eventId === 1),
    );
    expect(await service.getEvent('e1')).toEqual(catalog.data[0]);
  });

  it('skips relation queries for empty pages', async () => {
    const { service, builder, find, aggregate } = fixture();
    builder.getManyAndCount = async () => [[], 0];
    expect(
      (await service.listEvents({ page: 1, limit: 24 } as any)).data,
    ).toEqual([]);
    expect(find).not.toHaveBeenCalled();
    expect(aggregate).not.toHaveBeenCalled();
  });
});
