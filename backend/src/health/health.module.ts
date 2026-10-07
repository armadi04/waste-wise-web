import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import {
  DatabaseHealthService,
  HEALTH_DATABASE_POOL,
  createHealthDatabasePool,
} from './database-health.service';
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [
    {
      provide: HEALTH_DATABASE_POOL,
      inject: [getDataSourceToken()],
      useFactory: (dataSource: DataSource) =>
        createHealthDatabasePool(dataSource),
    },
    DatabaseHealthService,
  ],
})
export class HealthModule {}
