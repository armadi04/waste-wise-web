import '@/config/env'; // validate process.env before booting
import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '@/app.module';
import { buildSwaggerConfig } from '@/config/swagger.config';

async function generateSpec() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  writeFileSync(
    join(process.cwd(), 'swagger.json'),
    JSON.stringify(document, null, 2),
  );

  await app.close();
  process.exit(0);
}

void generateSpec();
