import { create } from 'zustand'
import type { Socket } from 'socket.io-client'

/**
 * Socket store — holds the live socket instance and connection status. The
 * connection lifecycle itself is effectful (auth-dependent, listeners, toasts,
 * query invalidation) and lives in `<SocketBridge />`, which writes here.
 */
interface SocketStore {
  socket: Socket | null
  isConnected: boolean
  setSocket: (socket: Socket | null) => void
  setConnected: (isConnected: boolean) => void
}

export const useSocketStore = create<SocketStore>((set) => ({
  socket: null,
  isConnected: false,
  setSocket: (socket) => set({ socket }),
  setConnected: (isConnected) => set({ isConnected }),
}))

/** Convenience selector for components that only need the socket instance. */
export const useSocket = () => ({
  socket: useSocketStore((s) => s.socket),
  isConnected: useSocketStore((s) => s.isConnected),
})
