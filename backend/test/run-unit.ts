import { testEnvironment } from './utils/test-environment';

const child = Bun.spawn(
  [process.execPath, '--no-env-file', ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env: testEnvironment(process.env, 'unit'),
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  },
);
process.exit(await child.exited);
