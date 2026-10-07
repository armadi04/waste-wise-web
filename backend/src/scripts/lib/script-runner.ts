import env from '@/config/env'; // validate process.env before touching the database
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '@/app.module';

interface RunScriptOptions {
  skipMigrations?: boolean;
  synchronize?: boolean;
}

/**
 * Boots a standalone Nest application context (no HTTP server), runs the given
 * task, and guarantees the context is closed and the process exits with a
 * meaningful code — `0` on success, `1` on failure so CI can detect it.
 *
 * Seeding-on-boot is disabled here so scripts control seeding explicitly.
 */
export async function runScript(
  task: (app: INestApplicationContext) => Promise<void>,
  options: RunScriptOptions = {},
): Promise<void> {
  process.env.DB_SEED = 'false';
  if (options.skipMigrations) {
    process.env.DB_SKIP_MIGRATIONS = 'true';
  }
  if (options.synchronize !== undefined) {
    env.DB_SYNCHRONIZE = options.synchronize;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: false,
  });

  try {
    await task(app);
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error(error);
    await app.close().catch(() => undefined);
    process.exit(1);
  }
}
