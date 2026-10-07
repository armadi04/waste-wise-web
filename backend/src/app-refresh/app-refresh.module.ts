import { Module } from '@nestjs/common';
import { AppRefreshController } from './app-refresh.controller';
import { AppRefreshService } from './app-refresh.service';

@Module({
  controllers: [AppRefreshController],
  providers: [AppRefreshService],
  // The notifications gateway replays the standing signal to each client as it
  // connects, so it needs to read the service.
  exports: [AppRefreshService],
})
export class AppRefreshModule {}
