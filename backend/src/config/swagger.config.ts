import { DocumentBuilder } from '@nestjs/swagger';
import { SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

export const SWAGGER_UI_PATH = '/api/docs';

/** Shared metadata. Operation paths include the REST prefix and URI version. */
export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('WasteWise API')
    .setDescription(
      'Smart Waste Management Platform API. REST URI version: v1; application releases are versioned independently.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
}

/** Call after configureApiRouting; docs are mounted outside REST versioning. */
export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup(
    SWAGGER_UI_PATH,
    app,
    () => SwaggerModule.createDocument(app, buildSwaggerConfig()),
    {
      useGlobalPrefix: false,
      jsonDocumentUrl: `${SWAGGER_UI_PATH}/openapi.json`,
      yamlDocumentUrl: `${SWAGGER_UI_PATH}/openapi.yaml`,
    },
  );
}
