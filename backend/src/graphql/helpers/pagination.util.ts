import type { PaginationInput } from '../generated/graphql';

/** Upper bound on GraphQL page size, matching REST's PaginationParamsDto @Max. */
export const MAX_PAGE_SIZE = 100;

/**
 * Clamps a value to an integer within [min, max], falling back to `fallback`
 * for null/undefined/NaN. GraphQL schema-first inputs are not run through
 * class-validator, so page/limit must be bounded here to prevent invalid
 * (0, negative) or abusive (huge) values reaching the query — limit:0 would
 * otherwise make lastPage = ceil(total/0) = Infinity, and a huge limit is a
 * memory-DoS vector.
 */
function clampInt(
  value: number | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value == null || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/**
 * Expands a GraphQL {@link PaginationInput} into the positional argument tuple
 * that `findAllPaginated` expects, with page/limit clamped to safe bounds.
 */
export function paginationArgs(
  input?: PaginationInput | null,
): [
  page: number,
  limit: number,
  search?: string,
  sort?: string,
  direction?: string,
] {
  return [
    clampInt(input?.page, 1, 1, Number.MAX_SAFE_INTEGER),
    clampInt(input?.limit, 10, 1, MAX_PAGE_SIZE),
    input?.search ?? undefined,
    input?.sort ?? undefined,
    input?.direction ?? undefined,
  ];
}
