import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaModule } from '../media/media.module';
import { ClassificationService } from './classification.service';
import { Report } from './entities/report.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsStatsController } from './reports-stats.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Report]), MediaModule],
  controllers: [ReportsController, ReportsStatsController],
  providers: [ReportsService, ClassificationService],
  exports: [ReportsService],
})
export class ReportsModule {}
