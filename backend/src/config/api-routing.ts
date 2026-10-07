import { INestApplication, VersioningType } from '@nestjs/common';

export const API_VERSION = '1';
export const API_BASE_PATH = `/api/v${API_VERSION}`;

/** Shared REST routing for runtime, contract generation and HTTP tests. */
export function configureApiRouting(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: API_VERSION,
  });
}
