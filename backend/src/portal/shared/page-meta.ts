export const pageMeta = (total: number, page: number, limit: number) => ({
  total,
  page,
  lastPage: Math.max(1, Math.ceil(total / limit)),
});
