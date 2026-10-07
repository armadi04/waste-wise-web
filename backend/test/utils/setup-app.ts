import { configureApiRouting } from '@/config/api-routing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import cookieParser from 'cookie-parser';
import { useContainer } from 'class-validator';
import { Logger } from 'nestjs-pino';
import { AppModule } from '@/app.module';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { MailService } from '@/mail/mail.service';
import { TurnstileService } from '@/auth/turnstile.service';
import { MediaStorageService } from '@/media/storage/media-storage.service';
import { NotificationsListener } from '@/notifications/notifications.listener';
import {
  makeFakeMail,
  makeFakeStorage,
  fakeTurnstile,
  passThroughGuard,
  type FakeMailService,
} from './fakes';

export interface TestContext {
  app: INestApplication;
  moduleRef: TestingModule;
  dataSource: DataSource;
  mail: FakeMailService;
}

/**
 * Boots the full application exactly as `main.ts` does (global prefix,
 * validation pipe, cookie parser, class-validator container, exception filter)
 * but with the external services replaced by deterministic fakes.
 */
export async function setupTestApp(
  dataSourceOverride?: DataSource,
): Promise<TestContext> {
  const mail = makeFakeMail();
  const storage = makeFakeStorage();

  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .overrideProvider(TurnstileService)
    .useValue(fakeTurnstile)
    .overrideProvider(MediaStorageService)
    .useValue({
      selected: {
        provider: 'depot',
        profile: 'depot-default',
        fingerprint: '0'.repeat(64),
        adapter: storage,
      },
      forMedia: () => storage,
    })
    // The notifications listener writes notification rows asynchronously
    // (fire-and-forget) on user events. In tests those writes race the
    // between-test cleanup and cause lock contention, so disable it — the
    // notifications endpoints are exercised directly in notifications.e2e.
    .overrideProvider(NotificationsListener)
    .useValue({})
    .overrideGuard(ThrottlerGuard)
    .useValue(passThroughGuard);
  if (dataSourceOverride)
    builder.overrideProvider(DataSource).useValue(dataSourceOverride);
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication({ bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  app.use(cookieParser());
  configureApiRouting(app);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  await app.init();

  const dataSource = app.get(DataSource);

  return { app, moduleRef, dataSource, mail };
}
