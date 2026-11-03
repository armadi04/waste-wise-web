import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import type { UserStatusUpdatedEvent } from '../users/user-events';

/** What callers emit on `audit.record`. */
export interface AuditEvent {
  action: string;
  eventId?: string;
  actorId?: number | null;
  actorEmail?: string | null;
  subjectType?: string | null;
  subjectId?: string | number | null;
  summary?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /** Durable event failures propagate to the outbox; ordinary audit writes remain best effort. */
  @OnEvent('audit.record', { suppressErrors: false })
  async record(event: AuditEvent): Promise<void> {
    try {
      if (
        event.eventId &&
        (await this.auditLogRepository.findOneBy({ eventId: event.eventId }))
      )
        return;
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          ...(event.eventId ? { eventId: event.eventId } : {}),
          action: event.action,
          actorId: event.actorId ?? null,
          actorEmail: event.actorEmail ?? null,
          subjectType: event.subjectType ?? null,
          subjectId:
            event.subjectId === null || event.subjectId === undefined
              ? null
              : String(event.subjectId),
          summary: event.summary ?? null,
          metadata: event.metadata ?? null,
          ipAddress: event.ipAddress ?? null,
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to record audit event ${event.action}`, error);
      if (event.eventId) throw error;
    }
  }

  @OnEvent('user.status_updated')
  async recordUserStatus(event: UserStatusUpdatedEvent): Promise<void> {
    await this.record({
      action: 'user.status_updated',
      actorId: event.actorId,
      actorEmail: event.actorEmail,
      subjectType: 'user',
      subjectId: event.targetId,
      summary: event.isActive
        ? `Activated user #${event.targetId}`
        : `Deactivated user #${event.targetId}`,
      metadata: { isActive: event.isActive, targetEmail: event.targetEmail },
      ipAddress: event.ipAddress,
    });
  }

  /** Read-only listing for the admin page. Newest first; no update or delete. */
  async findAllPaginated(
    page = 1,
    limit = 20,
    search?: string,
    sort = 'createdAt',
    direction = 'DESC',
    action?: string,
  ) {
    const currentPage = Math.max(1, page);
    const term = search ? ILike(`%${search}%`) : undefined;
    const scope = action ? { action } : {};

    const [data, total] = await this.auditLogRepository.findAndCount({
      where: term
        ? [
            { ...scope, actorEmail: term },
            { ...scope, action: term },
            { ...scope, summary: term },
            { ...scope, ipAddress: term },
          ]
        : scope,
      relations: { actor: true },
      order: { [sort]: direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC' },
      skip: (currentPage - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: { total, page: +currentPage, lastPage: Math.ceil(total / limit) },
    };
  }

  /** The distinct actions present, so the UI can offer a filter that matches reality. */
  async findActions(): Promise<Array<string>> {
    const rows = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('DISTINCT log.action', 'action')
      .orderBy('log.action', 'ASC')
      .getRawMany<{ action: string }>();
    return rows.map((row) => row.action);
  }
}
