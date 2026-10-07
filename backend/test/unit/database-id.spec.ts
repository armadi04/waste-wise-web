import { describe, expect, it } from 'bun:test';
import { parseDatabaseId } from '../../src/common/utils/database-id';

describe('parseDatabaseId', () => {
  it('accepts positive int4 primary keys', () => {
    expect(parseDatabaseId('1')).toBe(1);
    expect(parseDatabaseId('376')).toBe(376);
    expect(parseDatabaseId('2147483647')).toBe(2147483647);
  });

  it('rejects codes and values Postgres integer cannot bind', () => {
    for (const value of [
      'ORD-0070DE7A',
      'VCH-16CA2D4B',
      '',
      ' 12',
      '0',
      '-1',
      '012',
      '1e3',
      '1.5',
      'NaN',
      '2147483648',
      '99999999999',
    ])
      expect(parseDatabaseId(value)).toBeUndefined();
  });
});
