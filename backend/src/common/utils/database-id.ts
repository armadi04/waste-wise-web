const INT4_MAX = 2_147_483_647;

/**
 * Parses a route value as a Postgres `integer` primary key. Returns `undefined`
 * for codes such as `ORD-0070DE7A` (and for `""`, `1e3`, `-1`, overflow) so
 * callers never bind `NaN` or out-of-range numbers to an integer column.
 */
export function parseDatabaseId(value: string): number | undefined {
  if (!/^[1-9]\d{0,9}$/.test(value)) return undefined;
  const id = Number(value);
  return id <= INT4_MAX ? id : undefined;
}
