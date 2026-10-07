import { testEnvironment } from './test-environment';

const mode =
  process.env.NESTPLATE_TEST_MODE === 'unit' ? 'unit' : 'integration';
const environment = testEnvironment(process.env, mode);
for (const key of Object.keys(process.env)) delete process.env[key];
Object.assign(process.env, environment);
