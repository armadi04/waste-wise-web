import { configureApiRouting } from './config/api-routing';
import './config/env'; // validates process.env — throws on missing/invalid vars
import { NestFactory } from '@nestjs/core';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  createHttpAdapter,
  registerHttpPlugins,
  configureHttpCors,
} from './config/http';
import { AppModule } from './app.module';

import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { useContainer } from 'class-validator';
import { setupSwagger, SWAGGER_UI_PATH } from './config/swagger.config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    createHttpAdapter(),
    {
      bufferLogs: true,
    },
  );
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(Logger)));
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  await registerHttpPlugins(app);

  configureHttpCors(app);

  configureApiRouting(app);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    setupSwagger(app);
  }

  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
  if (process.env.NODE_ENV !== 'production') {
    app.get(Logger).log(`Swagger UI: ${await app.getUrl()}${SWAGGER_UI_PATH}`);
  }
}
void bootstrap();
