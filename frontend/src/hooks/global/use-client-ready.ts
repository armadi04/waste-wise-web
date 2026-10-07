import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}
export const useClientReady = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
