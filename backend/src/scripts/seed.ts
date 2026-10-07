import { SeederService } from '@/database/seeder/seeder.service';
import { runScript } from './lib/script-runner';

void runScript(async (app) => {
  await app.get(SeederService).seed();
});
