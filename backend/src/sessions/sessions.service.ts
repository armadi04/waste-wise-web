import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import crypto from 'crypto';
import { BaseService } from '../common/services/base.service';
import { UserSession } from './entities/user-session.entity';
import {
  nextIdleDeadline,
  sessionDeadlines,
  type SessionAudience,
} from './session-policy';

/** Request metadata captured at login so a user can recognise their devices. */
export interface SessionContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface StartedSession {
  sessionId: string;
  audience: SessionAudience;
  absoluteExpiresAt: Date;
}

/** Don't write `lastActiveAt` on every request — once a minute is plenty. */
const TOUCH_INTERVAL_MS = 60 * 1000;

@Injectable()
export class SessionsService extends BaseService<UserSession> {
  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
  ) {
    super(sessionRepository, 'Session', ['ipAddress', 'userAgent']);
  }

  /**
   * Mint a session row governed by the audience's idle/absolute policy and
   * return its id (embedded in the JWT) with the absolute deadline cookies use.
   */
  async start(
    userId: number,
    context: SessionContext = {},
    opts: {
      audience?: SessionAudience;
      impersonatedById?: number;
    } = {},
  ): Promise<StartedSession> {
    const now = new Date();
    const audience = opts.audience ?? 'admin';
    const deadlines = sessionDeadlines(audience, now);
    const session = this.sessionRepository.create({
      sessionId: crypto.randomUUID(),
      userId,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      impersonatedById: opts.impersonatedById ?? null,
      audience,
      lastActiveAt: now,
      ...deadlines,
    });
    const saved = await this.sessionRepository.save(session);
    return {
      sessionId: saved.sessionId,
      audience,
      absoluteExpiresAt: deadlines.absoluteExpiresAt,
    };
  }

  findBySessionId(sessionId: string): Promise<UserSession | null> {
    return this.sessionRepository.findOne({ where: { sessionId } });
  }

  /**
   * A session is usable while it is not revoked and neither its idle nor its
   * absolute deadline has passed.
   */
  async isActive(sessionId: string): Promise<boolean> {
    const now = new Date();
    const found = await this.sessionRepository.findOne({
      where: {
        sessionId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(now),
        absoluteExpiresAt: MoreThan(now),
      },
      select: { id: true },
    });
    return !!found;
  }

  /**
   * Record activity. Request traffic only stamps `lastActiveAt` (at most once a
   * minute, so it doesn't add a write per request); a refresh (`extend`) also
   * slides the idle deadline, capped by the absolute deadline. Returns the
   * refreshed row when extending, for callers that size cookies from it.
   */
  async touch(sessionId: string, extend = false): Promise<UserSession | null> {
    const now = new Date();
    if (!extend) {
      await this.sessionRepository.update(
        {
          sessionId,
          revokedAt: IsNull(),
          lastActiveAt: LessThan(new Date(now.getTime() - TOUCH_INTERVAL_MS)),
        },
        { lastActiveAt: now },
      );
      return null;
    }
    const session = await this.sessionRepository.findOne({
      where: { sessionId, revokedAt: IsNull() },
    });
    if (!session) return null;
    const expiresAt = nextIdleDeadline(
      session.audience,
      now,
      session.absoluteExpiresAt,
    );
    // A guarded column update, not save(): save() writes back every column of
    // the copy read above, so a revoke landing in between (e.g. refresh-token
    // reuse detection) would be undone.
    const result = await this.sessionRepository.update(
      { sessionId, revokedAt: IsNull() },
      { lastActiveAt: now, expiresAt },
    );
    if (!result.affected) return null;
    return Object.assign(session, { lastActiveAt: now, expiresAt });
  }

  /** Revoke every live session for an account, including impersonation sessions. */
  async revokeAllForUser(userId: number): Promise<{ revoked: number }> {
    const result = await this.sessionRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    return { revoked: result.affected ?? 0 };
  }

  /**
   * The user's own live sessions, most recently active first. Sessions opened by
   * an administrator signing in as them are left out: they aren't the user's
   * devices, and only someone allowed to impersonate may see that they exist.
   */
  findActiveForUser(userId: number): Promise<UserSession[]> {
    return this.sessionRepository.find({
      where: {
        userId,
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
        absoluteExpiresAt: MoreThan(new Date()),
        impersonatedById: IsNull(),
      },
      order: { lastActiveAt: 'DESC' },
    });
  }

  async revokeBySessionId(sessionId: string): Promise<void> {
    await this.sessionRepository.update(
      { sessionId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  /**
   * Revoke one row by primary key. `ownerId` scopes the lookup to that user so
   * the self-service endpoint can never end somebody else's session.
   */
  async revokeById(id: number, ownerId?: number): Promise<UserSession> {
    const session = await this.sessionRepository.findOne({ where: { id } });
    if (!session) {
      throw new NotFoundException(`Session #${id} not found`);
    }
    if (ownerId !== undefined && session.userId !== ownerId) {
      throw new ForbiddenException('That session belongs to another user');
    }
    if (!session.revokedAt) {
      session.revokedAt = new Date();
      await this.sessionRepository.save(session);

      this.eventEmitter.emit('audit.record', {
        action: 'session.revoked',
        actorId: ownerId ?? null,
        subjectType: 'session',
        subjectId: session.id,
        summary: `Session for user #${session.userId} revoked`,
        metadata: { userId: session.userId, ipAddress: session.ipAddress },
      });
    }
    return session;
  }

  /** Sign out everywhere else — used from the profile page. */
  async revokeOthersForUser(
    userId: number,
    keepSessionId?: string,
  ): Promise<{ revoked: number }> {
    const sessions = await this.findActiveForUser(userId);
    const targets = sessions.filter((s) => s.sessionId !== keepSessionId);
    if (targets.length) {
      // Only revokedAt is written, so concurrent refreshes keep their activity.
      await this.sessionRepository.update(
        {
          sessionId: In(targets.map((s) => s.sessionId)),
          revokedAt: IsNull(),
        },
        { revokedAt: new Date() },
      );
    }
    return { revoked: targets.length };
  }

  /**
   * Admin listing. Extends the base search to the owning user's name/email,
   * which is the only way an admin can find "whose session is this?".
   *
   * Impersonated sessions are hidden unless the caller may impersonate: they
   * reveal that an administrator signed in as someone, which is not something
   * every session reader is entitled to know.
   */
  async findAllForAdmin(
    page = 1,
    limit = 10,
    search?: string,
    sort = 'lastActiveAt',
    direction = 'DESC',
    includeImpersonated = false,
  ) {
    const currentPage = Math.max(1, page);
    const term = search ? ILike(`%${search}%`) : undefined;
    const visibility = includeImpersonated
      ? {}
      : { impersonatedById: IsNull() };

    const [data, total] = await this.sessionRepository.findAndCount({
      where: term
        ? [
            { ...visibility, ipAddress: term },
            { ...visibility, userAgent: term },
            { ...visibility, user: { email: term } },
            { ...visibility, user: { fullname: term } },
          ]
        : visibility,
      relations: { user: true },
      order: { [sort]: direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC' },
      skip: (currentPage - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: { total, page: +currentPage, lastPage: Math.ceil(total / limit) },
    };
  }
}
