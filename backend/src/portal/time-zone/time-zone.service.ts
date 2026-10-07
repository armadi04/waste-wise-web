import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User } from '@/users/entities/user.entity';
import {
  BUSINESS_TIME_ZONES,
  isLocalDateTime,
  isTimeZone,
  toBusinessDateInput,
} from '@/common/utils/business-time';
import env from '@/config/env';
import {
  TimeZonePreferenceDto,
  ScheduleTimeDto,
} from '@/portal/time-zone/dto/time-zone.dto';
@Injectable()
export class TimeZoneService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}
  config() {
    return {
      defaultTimeZone: env.APP_DEFAULT_TIME_ZONE,
      businessTimeZones: BUSINESS_TIME_ZONES,
    };
  }
  async preferences(userId: number) {
    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ id: userId });
    if (!user) throw new NotFoundException('Account not found');
    return {
      timeZone: user.timeZone,
      lastDetectedTimeZone: user.lastDetectedTimeZone,
    };
  }
  async updatePreferences(userId: number, dto: TimeZonePreferenceDto) {
    for (const value of [dto.timeZone, dto.lastDetectedTimeZone])
      if (value != null && !isTimeZone(value))
        throw new BadRequestException('Invalid IANA timezone');
    await this.preferences(userId);
    if (Object.keys(dto).length)
      await this.dataSource.getRepository(User).update(userId, dto);
    return this.preferences(userId);
  }
  async preview(
    localDateTime: string,
    timeZone: string,
    manager: EntityManager = this.dataSource.manager,
  ) {
    if (
      !isLocalDateTime(localDateTime) ||
      !(BUSINESS_TIME_ZONES as readonly string[]).includes(timeZone)
    )
      throw new BadRequestException('Invalid local date or business timezone');
    const rows = await manager.query<Array<{ instant: Date }>>(
      'SELECT $1::timestamp AT TIME ZONE $2::text AS instant',
      [localDateTime, timeZone],
    );
    return {
      instant: rows[0].instant.toISOString(),
      localDateTime: toBusinessDateInput(rows[0].instant, timeZone),
      timeZone,
    };
  }
  async prepare<T extends ScheduleTimeDto>(
    dto: T,
    fields: string[],
    current?: Record<string, unknown>,
    manager?: EntityManager,
  ) {
    const { localTimes, timeZoneChangeMode, timeZoneChangeReason, ...data } =
      dto;
    const zone =
      dto.timeZone ??
      (current?.timeZone as string | undefined) ??
      env.APP_DEFAULT_TIME_ZONE;
    const changesZone = Boolean(
      current && dto.timeZone && zone !== current.timeZone,
    );
    if (changesZone && (!timeZoneChangeMode || !timeZoneChangeReason?.trim()))
      throw new BadRequestException(
        'Choose timezone change mode and provide a reason',
      );
    if (localTimes && !dto.timeZone)
      throw new BadRequestException(
        'Local times require an explicit business timezone',
      );
    const result = { ...data } as Record<string, unknown>;
    for (const [field, local] of Object.entries(localTimes ?? {})) {
      if (!fields.includes(field) || result[field] !== undefined)
        throw new BadRequestException('Unknown or ambiguous timestamp field');
      if (!isLocalDateTime(local))
        throw new BadRequestException('Invalid local datetime');
      if (changesZone && timeZoneChangeMode === 'preserveInstant') continue;
      result[field] = new Date(
        (await this.preview(local, zone, manager)).instant,
      );
    }
    if (changesZone)
      for (const field of fields) {
        const value = current?.[field];
        if (!value) continue;
        if (timeZoneChangeMode === 'preserveInstant') result[field] = value;
        else if (result[field] === undefined)
          result[field] = new Date(
            (
              await this.preview(
                toBusinessDateInput(value as Date, String(current?.timeZone)),
                zone,
                manager,
              )
            ).instant,
          );
      }
    return result;
  }
  recordChange(
    actorId: number,
    subjectType: string,
    subjectId: number,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    dto: ScheduleTimeDto,
  ) {
    if (before.timeZone === after.timeZone) return;
    this.events.emit('audit.record', {
      action: 'portal.timezone_changed',
      actorId,
      subjectType,
      subjectId: String(subjectId),
      summary: 'Business timezone changed',
      metadata: {
        before,
        after,
        mode: dto.timeZoneChangeMode,
        reason: dto.timeZoneChangeReason,
      },
    });
  }
}
