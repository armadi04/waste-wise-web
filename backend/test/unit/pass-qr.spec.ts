import { describe, expect, it } from 'bun:test';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassQrService } from '@/portal/passes/pass-qr.service';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import type { Repository } from 'typeorm';

const JWT_SECRET = 'login_secret_for_unit_tests';

const matches = (row: any, where: any) =>
  (Array.isArray(where) ? where : [where]).some((clause) =>
    Object.entries(clause).every(([key, value]) => row[key] === value),
  );

function fixture(
  overrides: {
    voucher?: Partial<PortalVoucher>;
    ticket?: Partial<PortalTicket>;
    event?: Partial<PortalEvent>;
    env?: object;
  } = {},
) {
  const voucher = {
    id: 7,
    publicId: '11111111-1111-4111-8111-111111111111',
    userId: 1,
    code: 'VCH-ABC',
    status: 'Issued',
    expiresAt: new Date(Date.now() + 86_400_000),
    ...overrides.voucher,
  };
  const ticket = {
    id: 9,
    publicId: '22222222-2222-4222-8222-222222222222',
    userId: 1,
    code: 'TCK-ABC',
    status: 'Issued',
    eventId: 3,
    ...overrides.ticket,
  };
  const event = {
    id: 3,
    startsAt: new Date(Date.now() + 3_600_000),
    ...overrides.event,
  };
  const repo = (row: any) => ({
    findOne: async ({ where }: any) => (matches(row, where) ? row : null),
    findOneBy: async (where: any) => (matches(row, where) ? row : null),
  });
  const config = new ConfigService({ JWT_SECRET, ...overrides.env });
  const service = new PassQrService(
    repo(voucher) as unknown as Repository<PortalVoucher>,
    repo(ticket) as unknown as Repository<PortalTicket>,
    repo(event) as unknown as Repository<PortalEvent>,
    config,
  );
  return { service };
}

describe('pass QR tokens', () => {
  it('issues a prefixed short-lived token that resolves to the internal id', async () => {
    const { service } = fixture();
    const issued = await service.issue('voucher', 1, 'VCH-ABC');
    expect(issued.token.startsWith('KM1.')).toBe(true);
    const ttl = new Date(issued.expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(50_000);
    expect(ttl).toBeLessThanOrEqual(60_000);
    expect(issued.expiresIn).toBe(60);
    expect(await service.resolve('voucher', issued.token)).toBe(7);

    const ticket = await service.issue('ticket', 1, 'TCK-ABC');
    expect(await service.resolve('ticket', ticket.token)).toBe(9);
  });

  it('honours the configured TTL', async () => {
    const { service } = fixture({ env: { PASS_QR_TTL_SECONDS: '120' } });
    const issued = await service.issue('voucher', 1, 'VCH-ABC');
    expect(issued.expiresIn).toBe(120);
    expect(new Date(issued.expiresAt).getTime() - Date.now()).toBeGreaterThan(
      110_000,
    );
  });

  it('hides passes owned by another user', async () => {
    const { service } = fixture();
    await expect(service.issue('voucher', 2, 'VCH-ABC')).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.issue('ticket', 2, 'TCK-ABC')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuses unusable passes', async () => {
    for (const voucher of [
      { status: 'Redeemed' },
      { expiresAt: new Date(Date.now() - 1000) },
    ]) {
      const { service } = fixture({ voucher });
      await expect(service.issue('voucher', 1, 'VCH-ABC')).rejects.toThrow(
        ConflictException,
      );
    }
  });

  it('rejects wrong-kind or unprefixed tokens as 400 and expired ones as 410', async () => {
    const { service } = fixture();
    const issued = await service.issue('voucher', 1, 'VCH-ABC');
    await expect(service.resolve('ticket', issued.token)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.resolve('voucher', issued.token.slice(4)),
    ).rejects.toThrow(BadRequestException);

    const short = fixture({ env: { PASS_QR_SECRET: 'x'.repeat(32) } });
    const expired = await new JwtService({ secret: 'x'.repeat(32) }).signAsync({
      typ: 'pass-qr',
      k: 'v',
      pid: '11111111-1111-4111-8111-111111111111',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    await expect(
      short.service.resolve('voucher', `KM1.${expired}`),
    ).rejects.toThrow(GoneException);
  });

  it('rejects tokens signed with the login secret', async () => {
    const { service } = fixture();
    const forged = await new JwtService({ secret: JWT_SECRET }).signAsync({
      typ: 'pass-qr',
      k: 'v',
      pid: '11111111-1111-4111-8111-111111111111',
    });
    await expect(service.resolve('voucher', `KM1.${forged}`)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('cannot be used as a login token', async () => {
    const { service } = fixture();
    const issued = await service.issue('voucher', 1, 'VCH-ABC');
    await expect(
      new JwtService({ secret: JWT_SECRET }).verifyAsync(issued.token.slice(4)),
    ).rejects.toThrow();
  });

  it('refuses tickets that are used or past the check-in window', async () => {
    for (const overrides of [
      { ticket: { status: 'CheckedIn' } },
      { event: { startsAt: new Date(Date.now() - 86_400_001) } },
      { event: { id: 99 } },
    ]) {
      const { service } = fixture(overrides);
      await expect(service.issue('ticket', 1, 'TCK-ABC')).rejects.toThrow(
        ConflictException,
      );
    }
    const late = fixture({
      event: { startsAt: new Date(Date.now() - 82_800_000) },
    });
    expect(
      (await late.service.issue('ticket', 1, 'TCK-ABC')).token,
    ).toStartWith('KM1.');
  });

  it('pins HS256 so tokens signed with another algorithm are refused', async () => {
    const secret = 'x'.repeat(32);
    const { service } = fixture({ env: { PASS_QR_SECRET: secret } });
    const issued = await service.issue('voucher', 1, 'VCH-ABC');
    const header = JSON.parse(
      Buffer.from(issued.token.slice(4).split('.')[0], 'base64url').toString(),
    );
    expect(header.alg).toBe('HS256');
    const hs512 = await new JwtService({ secret }).signAsync(
      {
        typ: 'pass-qr',
        k: 'v',
        pid: '11111111-1111-4111-8111-111111111111',
      },
      { algorithm: 'HS512' },
    );
    await expect(service.resolve('voucher', `KM1.${hs512}`)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('reports a deleted pass as 404 on scan', async () => {
    const issuer = fixture();
    const issued = await issuer.service.issue('voucher', 1, 'VCH-ABC');
    const gone = fixture({ voucher: { publicId: 'another' } });
    await expect(gone.service.resolve('voucher', issued.token)).rejects.toThrow(
      NotFoundException,
    );
  });
});
