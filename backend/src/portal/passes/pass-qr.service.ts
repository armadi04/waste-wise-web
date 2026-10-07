import * as crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PortalEvent } from '@/portal/catalog/entities/portal-event.entity';
import { PortalTicket } from '@/portal/passes/entities/portal-ticket.entity';
import { PortalVoucher } from '@/portal/passes/entities/portal-voucher.entity';
import { PASS_STATUS } from '@/portal/passes/pass-status';
import { isTicketWindowOpen } from '@/portal/passes/ticket-window';
import { parseDatabaseId } from '@/common/utils/database-id';

export type PassKind = 'voucher' | 'ticket';

const TOKEN_PREFIX = 'KM1.';
const TOKEN_TYPE = 'pass-qr';
const ALGORITHM = 'HS256';

interface PassQrPayload {
  typ: typeof TOKEN_TYPE;
  k: 'v' | 't';
  pid: string;
}

/**
 * Short-lived signed tokens for customer voucher/ticket QR codes. Signed with
 * PASS_QR_SECRET (or a key derived from JWT_SECRET), never the login secret, so
 * a scanned token cannot authenticate as the customer. Tokens are stateless:
 * replay inside the TTL is harmless because usage verification is idempotent.
 *
 * Scan failures are 400 (malformed/forged/wrong kind) or 410 (expired), never
 * 401: staff clients treat 401 as an expired session and refresh it.
 */
@Injectable()
export class PassQrService {
  private readonly jwt: JwtService;
  private readonly ttlSeconds: number;

  constructor(
    @InjectRepository(PortalVoucher)
    private readonly voucherRepository: Repository<PortalVoucher>,
    @InjectRepository(PortalTicket)
    private readonly ticketRepository: Repository<PortalTicket>,
    @InjectRepository(PortalEvent)
    private readonly eventRepository: Repository<PortalEvent>,
    configService: ConfigService,
  ) {
    const secret =
      configService.get<string>('PASS_QR_SECRET') ||
      crypto
        .scryptSync(
          configService.get<string>('JWT_SECRET') ?? 'secretKey',
          'kuponmalam.pass-qr',
          32,
        )
        .toString('hex');
    this.jwt = new JwtService({
      secret,
      signOptions: { algorithm: ALGORITHM },
      verifyOptions: { algorithms: [ALGORITHM] },
    });
    const ttl = Number(configService.get<string>('PASS_QR_TTL_SECONDS'));
    this.ttlSeconds = Number.isInteger(ttl) && ttl > 0 ? ttl : 60;
  }

  async issue(kind: PassKind, userId: number, ref: string) {
    const publicId =
      kind === 'voucher'
        ? await this.usableVoucher(userId, ref)
        : await this.usableTicket(userId, ref);
    const payload: PassQrPayload = {
      typ: TOKEN_TYPE,
      k: kind === 'voucher' ? 'v' : 't',
      pid: publicId,
    };
    const token = await this.jwt.signAsync(payload, {
      expiresIn: this.ttlSeconds,
    });
    const { exp } = this.jwt.decode<{ exp: number }>(token);
    return {
      token: `${TOKEN_PREFIX}${token}`,
      expiresAt: new Date(exp * 1000).toISOString(),
      // Clients count down from receipt with this, so a skewed device clock
      // cannot make a fresh token look expired.
      expiresIn: this.ttlSeconds,
    };
  }

  /** Resolve a scanned token to the internal id used by usage verification. */
  async resolve(kind: PassKind, token: string): Promise<number> {
    if (!token.startsWith(TOKEN_PREFIX))
      throw new BadRequestException('Invalid pass token');
    let payload: PassQrPayload;
    try {
      payload = await this.jwt.verifyAsync<PassQrPayload>(
        token.slice(TOKEN_PREFIX.length),
      );
    } catch (error) {
      if (error instanceof TokenExpiredError)
        throw new GoneException('Pass token expired; ask for a fresh QR');
      throw new BadRequestException('Invalid pass token');
    }
    if (
      payload.typ !== TOKEN_TYPE ||
      payload.k !== (kind === 'voucher' ? 'v' : 't') ||
      typeof payload.pid !== 'string'
    )
      throw new BadRequestException('Invalid pass token');
    const repository =
      kind === 'voucher' ? this.voucherRepository : this.ticketRepository;
    const pass = await repository.findOneBy({ publicId: payload.pid });
    if (!pass)
      throw new NotFoundException(
        kind === 'voucher' ? 'Voucher not found' : 'Ticket not found',
      );
    return pass.id;
  }

  private async usableVoucher(userId: number, codeOrId: string) {
    const numericId = parseDatabaseId(codeOrId);
    const voucher = await this.voucherRepository.findOne({
      where:
        numericId === undefined
          ? { code: codeOrId, userId }
          : [
              { id: numericId, userId },
              { code: codeOrId, userId },
            ],
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (
      voucher.status !== PASS_STATUS.Issued ||
      voucher.expiresAt <= new Date()
    )
      throw new ConflictException('Pass cannot be used');
    return voucher.publicId;
  }

  // Mirrors PortalCampaignService.verifyUsage so a QR is never handed out that
  // staff would be refused on scan.
  private async usableTicket(userId: number, code: string) {
    const ticket = await this.ticketRepository.findOneBy({ userId, code });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const event =
      ticket.status === PASS_STATUS.Issued
        ? await this.eventRepository.findOneBy({ id: ticket.eventId })
        : null;
    if (!event || !isTicketWindowOpen(event.startsAt))
      throw new ConflictException('Pass cannot be used');
    return ticket.publicId;
  }
}
