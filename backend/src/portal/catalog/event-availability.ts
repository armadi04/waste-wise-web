import { ConflictException, BadRequestException } from '@nestjs/common';
import { EntityManager, FindOptionsWhere } from 'typeorm';
import { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';

export type EventAvailability = {
  state: 'available' | 'limited' | 'sold-out' | 'unavailable';
  remaining: number;
};

export function eventAvailability(
  stocks: readonly number[],
): EventAvailability {
  if (stocks.some((stock) => !Number.isSafeInteger(stock) || stock < 0)) {
    throw new ConflictException('Invalid event ticket stock');
  }
  const remaining = stocks.reduce((total, stock) => total + stock, 0);
  const state = !stocks.length
    ? 'unavailable'
    : remaining === 0
      ? 'sold-out'
      : remaining <= 10
        ? 'limited'
        : 'available';
  return { state, remaining };
}

export function eventAvailabilityLabel(
  availability: EventAvailability,
): string {
  switch (availability.state) {
    case 'available':
      return 'Tersedia';
    case 'limited':
      return `Sisa ${availability.remaining} tiket`;
    case 'sold-out':
      return 'Tiket habis';
    case 'unavailable':
      return 'Tiket belum tersedia';
  }
}

export function assertEventTicketStock(
  stockTotal: number | undefined,
  stockRemaining: number | undefined,
) {
  if (
    typeof stockTotal !== 'number' ||
    typeof stockRemaining !== 'number' ||
    !Number.isSafeInteger(stockTotal) ||
    !Number.isSafeInteger(stockRemaining) ||
    stockTotal < 0 ||
    stockRemaining < 0 ||
    stockRemaining > stockTotal
  ) {
    throw new BadRequestException(
      'Ticket stock must satisfy 0 <= remaining <= total',
    );
  }
}

export async function lockEventTicket(
  manager: EntityManager,
  where: FindOptionsWhere<PortalEventTicket>,
) {
  return manager.getRepository(PortalEventTicket).findOne({
    where,
    lock: { mode: 'pessimistic_write' },
  });
}
