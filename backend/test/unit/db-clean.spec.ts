import { expect, it, mock } from 'bun:test';
import type { DataSource } from 'typeorm';
import { cleanDatabase } from '../utils/db-clean';
it('rejects cleanup against any database other than the dedicated test database before executing SQL', async () => {
  const query = mock(() => Promise.resolve([]));
  await expect(
    cleanDatabase(
      {
        options: { type: 'postgres', database: 'application' },
        query,
      } as unknown as DataSource,
      'test@example.test',
    ),
  ).rejects.toThrow('dedicated');
  expect(query).not.toHaveBeenCalled();
});
