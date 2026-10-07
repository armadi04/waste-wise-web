import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import {
  BUSINESS_TIME_ZONES,
  isLocalDateTime,
  toBusinessDateInput,
} from '@/common/utils/business-time';
import env from '@/config/env';
import { TimeZonePreferenceDto } from './dto/time-zone.dto';

@Injectable()
export class TimeZoneService {
  constructor(private readonly dataSource: DataSource) {}

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
    await this.preferences(userId);
    if (Object.keys(dto).length)
      await this.dataSource.getRepository(User).update(userId, dto);
    return this.preferences(userId);
  }
  async preview(localDateTime: string, timeZone: string) {
    if (
      !isLocalDateTime(localDateTime) ||
      !(BUSINESS_TIME_ZONES as readonly string[]).includes(timeZone)
    )
      throw new BadRequestException('Invalid local date or business timezone');
    const rows = await this.dataSource.query<Array<{ instant: Date }>>(
      'SELECT $1::timestamp AT TIME ZONE $2::text AS instant',
      [localDateTime, timeZone],
    );
    return {
      instant: rows[0].instant.toISOString(),
      localDateTime: toBusinessDateInput(rows[0].instant, timeZone),
      timeZone,
    };
  }
}
