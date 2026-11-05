import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { configureApiRouting } from '@/config/api-routing';
import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DataSource } from 'typeorm';
import { createHttpAdapter, registerHttpPlugins } from '@/config/http';
import { useContainer } from 'class-validator';
import { Logger } from 'nestjs-pino';
import { AppModule } from '@/app.module';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { MailService } from '@/mail/mail.service';
import { TurnstileService } from '@/auth/turnstile.service';
import { MediaStorageService } from '@/media/storage/media-storage.service';
import { NotificationsListener } from '@/notifications/notifications.listener';
import { ClassificationService } from '@/reports/classification.service';
import {
  makeFakeClassifier,
  makeFakeMail,
  makeFakeStorage,
  fakeTurnstile,
  passThroughGuard,
  type FakeClassifier,
  type FakeMailService,
} from './fakes';

export interface TestContext {
  app: NestFastifyApplication;
  moduleRef: TestingModule;
  dataSource: DataSource;
  mail: FakeMailService;
  classifier: FakeClassifier;
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
  const classifier = makeFakeClassifier();

  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService)
    .useValue(mail)
    .overrideProvider(TurnstileService)
    .useValue(fakeTurnstile)
    .overrideProvider(MediaStorageService)
    .useValue({
      selected: {
        provider: 's3',
        profile: 's3-default',
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
    .overrideProvider(ClassificationService)
    .useValue(classifier)
    .overrideGuard(ThrottlerGuard)
    .useValue(passThroughGuard);
  if (dataSourceOverride)
    builder.overrideProvider(DataSource).useValue(dataSourceOverride);
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    createHttpAdapter(),
    {
      bufferLogs: true,
    },
  );
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  await registerHttpPlugins(app);
  configureApiRouting(app);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const dataSource = app.get(DataSource);

  return { app, moduleRef, dataSource, mail, classifier };
}
