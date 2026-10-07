import { testEnvironment } from '../utils/test-environment';

if (
  process.env.TEST_DB_HOST !== '127.0.0.1' ||
  process.env.TEST_DB_PORT !== '55439'
) {
  throw new Error(
    'Health integration tests require disposable PostgreSQL at 127.0.0.1:55439',
  );
}
const child = Bun.spawn(
  [
    process.execPath,
    '--no-env-file',
    'test',
    'test/integration/health-database.spec.ts',
    '--timeout=30000',
    '--max-concurrency=1',
  ],
  {
    cwd: process.cwd(),
    env: testEnvironment(process.env, 'integration'),
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  },
);
process.exit(await child.exited);
