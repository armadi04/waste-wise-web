import { Module } from '@nestjs/common';
import { TimeZoneController } from './time-zone.controller';
import { TimeZoneService } from './time-zone.service';

@Module({ controllers: [TimeZoneController], providers: [TimeZoneService] })
export class TimeZoneModule {}
