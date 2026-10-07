import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Media } from '../media/entities/media.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { UserSession } from '../sessions/entities/user-session.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

/** Dashboard counters. Reads other modules' tables; owns no schema. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Media,
      Notification,
      UserSession,
      AuditLog,
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
