import { DataSource } from 'typeorm';
import { SeederService } from '@/database/seeder/seeder.service';
import { runScript } from './lib/script-runner';

const shouldSeed = process.argv.includes('--seed');

void runScript(
  async (app) => {
    const dataSource = app.get(DataSource);

    console.log('Dropping database schema...');
    await dataSource.dropDatabase();
    console.log('Running database migrations...');
    await dataSource.runMigrations();
    console.log('Database schema migrated.');

    if (shouldSeed) {
      console.log('Seeding database...');
      await app.get(SeederService).seed();
      console.log('Seeding complete.');
    }
  },
  { skipMigrations: true },
);
