import { DocumentBuilder } from '@nestjs/swagger';

export interface SwaggerConfigOptions {
  /** Add the global `/api` prefix as a server entry (used by the live docs). */
  apiPrefix?: boolean;
}

/**
 * Single source of truth for the OpenAPI document metadata, shared by the live
 * Swagger UI (`main.ts`) and the static spec generator (`scripts/generate-spec.ts`).
 */
export function buildSwaggerConfig(options: SwaggerConfigOptions = {}) {
  const builder = new DocumentBuilder()
    .setTitle('Kupon Malam API')
    .setDescription('The Kupon Malam API description')
    .setVersion('1.0');

  if (options.apiPrefix) {
    builder.addServer('/api', 'API prefix');
  }

  return builder.addBearerAuth().build();
}
