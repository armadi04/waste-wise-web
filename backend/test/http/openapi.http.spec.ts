import { describe, expect, it } from 'bun:test';
import { contractSnapshot } from '@/scripts/lib/contract-snapshot';
import baseline from '../../swagger.json';

describe('OpenAPI contract without database', () => {
  it('matches the checked-in document using every real controller and DTO', async () => {
    expect(await contractSnapshot()).toEqual(baseline as never);
  });
});
