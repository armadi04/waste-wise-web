import { useConfirmationStore } from '@/lib/stores/confirmation.store'

/**
 * Returns the promise-based `confirm()` action. Thin wrapper over
 * {@link useConfirmationStore} kept for call-site compatibility.
 */
export function useConfirmation() {
  return { confirm: useConfirmationStore((s) => s.confirm) }
}
