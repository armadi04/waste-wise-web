import { describe, expect, it, mock } from 'bun:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PortalEventTicketAdminService } from '@/portal/admin/portal-admin.service';
import { PortalEventTicket } from '@/portal/catalog/entities/portal-event-ticket.entity';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import type { Repository } from 'typeorm';

function fixture() {
  const row = {
    id: 2,
    eventId: 1,
    name: 'Regular',
    stockTotal: 20,
    stockRemaining: 5,
  };
  const save = mock(async (ticket: any) => ({ ...ticket }));
  const repository = {
    create: (data: any) => data,
    save,
    findOne: async (options: any) => {
      expect(options.lock.mode).toBe('pessimistic_write');
      return { ...row };
    },
    manager: {
      transaction: async (run: (manager: any) => Promise<any>) =>
        run({ getRepository: () => repository }),
    },
  };
  const service = new PortalEventTicketAdminService(
    repository as unknown as Repository<PortalEventTicket>,
    {
      findOneBy: async () => ({ id: 1 }),
    } as unknown as Repository<PortalEvent>,
  );
  return { service, save };
}

describe('event ticket admin stock rules', () => {
  it('rejects invalid creation before saving', async () => {
    const { service, save } = fixture();
    for (const [stockTotal, stockRemaining] of [
      [2, 3],
      [-1, 0],
      [2, -1],
      [2, 1.5],
    ]) {
      await expect(
        service.create({ eventId: 1, stockTotal, stockRemaining }),
      ).rejects.toThrow(BadRequestException);
    }
    expect(save).not.toHaveBeenCalled();
  });

  it('validates partial edits against the locked current stock', async () => {
    const { service, save } = fixture();
    await expect(service.update(2, { stockTotal: 4 })).rejects.toThrow(
      ConflictException,
    );
    expect(save).not.toHaveBeenCalled();
    expect(
      await service.update(2, { name: 'Renamed', stockRemaining: 21 }),
    ).toMatchObject({
      stockTotal: 20,
      stockRemaining: 5,
    });
    expect(
      await service.update(2, { stockTotal: 30, stockRemaining: 5 }),
    ).toMatchObject({
      stockTotal: 30,
      stockRemaining: 15,
    });
    expect(await service.update(2, { stockTotal: 15 })).toMatchObject({
      stockTotal: 15,
      stockRemaining: 0,
    });
  });
});
