import './config/env'; // validates process.env — throws on missing/invalid vars
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { parseTrustProxy } from './common/utils/request-logging';
import { AppModule } from './app.module';

import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';

import { useContainer } from 'class-validator';
import { buildSwaggerConfig } from './config/swagger.config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  // Behind the portal BFF every request arrives from one address; trusting that
  // proxy's X-Forwarded-For gives throttling and sessions the real client IP.
  const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy);
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  app.use(cookieParser());

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const useWildcard = allowedOrigins.includes('*');

  // Reflecting an arbitrary Origin together with credentials:true is the classic
  // CORS misconfiguration — any site could then make credentialed requests and
  // read the response. So credentials are only enabled when an explicit origin
  // allow-list is configured; a wildcard config serves non-credentialed CORS.
  const allowCredentials = !useWildcard;

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Wildcard: allow the origin but WITHOUT credentials (set below).
      if (useWildcard) {
        callback(null, true);
        return;
      }

      // Check if origin is in the allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: allowCredentials,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-CSRF-Token',
      'Idempotency-Key',
      'X-Portal-Webhook-Secret',
    ],
  });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = buildSwaggerConfig({ apiPrefix: true });
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
