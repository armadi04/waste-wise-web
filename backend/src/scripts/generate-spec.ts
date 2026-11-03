import '@/config/env';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';
import { contractSnapshot } from './lib/contract-snapshot';

async function generateSpec() {
  const document = await contractSnapshot();
  const output = join(process.cwd(), 'swagger.json');
  // Controller discovery order is irrelevant to the API contract. Avoid churn
  // in the generated artifact when its paths, schemas and metadata are identical.
  if (
    existsSync(output) &&
    isDeepStrictEqual(JSON.parse(readFileSync(output, 'utf8')), document)
  )
    return;
  writeFileSync(output, JSON.stringify(document, null, 2));
}

void generateSpec();
