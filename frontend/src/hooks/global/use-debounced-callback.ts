import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a stable debounced wrapper around `fn`. Trailing-edge: the call fires
 * `delay` ms after the last invocation. Pending timers are cleared on unmount.
 */
export function useDebouncedCallback<TArgs extends Array<unknown>>(
  fn: (...args: TArgs) => void,
  delay = 400,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef = useRef(fn)

  useEffect(() => {
    fnRef.current = fn
  }, [fn])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return useCallback(
    (...args: TArgs) => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => fnRef.current(...args), delay)
    },
    [delay],
  )
}
