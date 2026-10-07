import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AuthModule } from '@/auth/auth.module';
import { AuthService } from '@/auth/auth.service';
import { TwoFactorService } from '@/auth/two-factor.service';
import { TurnstileService } from '@/auth/turnstile.service';
import { MailModule } from '@/mail/mail.module';
import { MailService } from '@/mail/mail.service';
import { NotificationsModule } from '@/notifications/notifications.module';
import { NotificationsService } from '@/notifications/notifications.service';
import { SessionsModule } from '@/sessions/sessions.module';
import { SessionsService } from '@/sessions/sessions.service';
import { UsersModule } from '@/users/users.module';
import { UsersService } from '@/users/users.service';
import { MediaModule } from '@/media/media.module';
import { MediaService } from '@/media/media.service';
import { CacheService } from '@/common/cache/cache.service';
import { PortalModule } from '@/portal/portal.module';

const externalServices = [
  AuthService,
  TwoFactorService,
  TurnstileService,
  MailService,
  NotificationsService,
  SessionsService,
  UsersService,
  MediaService,
];

@Module({
  providers: externalServices.map((provide) => ({ provide, useValue: {} })),
  exports: externalServices,
})
class ExternalServicesStubModule {}

/** Compiles the real portal providers without database, Redis, mail, or storage connections. */
export async function compilePortalModule() {
  const repository = {};
  const dataSource = {
    entityMetadatas: [],
    options: { type: 'postgres' },
    getRepository: () => repository,
  };
  const providers = [
    { provide: DataSource, useValue: dataSource },
    {
      provide: ConfigService,
      useValue: new ConfigService({
        JWT_SECRET: 'portal-module-unit-test-secret',
        PASS_QR_SECRET: 'portal-qr-unit-test-secret',
      }),
    },
    { provide: EventEmitter2, useValue: new EventEmitter2() },
    { provide: CacheService, useValue: { clearKeys: async () => {} } },
  ];
  @Global()
  @Module({
    imports: [
      CacheModule.register({ isGlobal: true }),
      ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ],
    providers,
    exports: [...providers.map(({ provide }) => provide), ThrottlerModule],
  })
  class InfrastructureStubModule {}

  const builder = Test.createTestingModule({
    imports: [InfrastructureStubModule, PortalModule],
  });
  for (const imported of [
    AuthModule,
    MailModule,
    NotificationsModule,
    SessionsModule,
    UsersModule,
    MediaModule,
  ]) {
    builder.overrideModule(imported).useModule(ExternalServicesStubModule);
  }
  return builder.compile();
}
