export function reorder<T>(items: Array<T>, index: number, direction: number) {
  const next = [...items]
  const other = index + direction
  if (other < 0 || other >= items.length) return next
  ;[next[index], next[other]] = [next[other], next[index]]
  return next
}
