import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSession } from './entities/user-session.entity';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';

/**
 * Device/session tracking. Exposes {@link SessionsService} so the auth layer can
 * open a session at login and the JWT strategy can reject revoked ones — the
 * controller lives here, but the lifecycle is driven from AuthModule.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserSession])],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
