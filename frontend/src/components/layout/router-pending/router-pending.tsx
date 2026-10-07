import { useRouterState } from '@tanstack/react-router'
import { motion } from 'framer-motion'

/**
 * Keeps the router's `defaultPendingComponent` slot filled so `pendingMs` /
 * `pendingMinMs` still gate when a match turns pending. The overlay users see
 * is `RouterPendingOverlay`, mounted at the root outside the layout shell so it
 * covers the whole viewport.
 */
export function RouterPendingPlaceholder() {
  return null
}

export function RouterPendingOverlay() {
  const isPending = useRouterState({
    select: (state) =>
      state.matches.some((match) => match.status === 'pending'),
  })

  if (!isPending) return null

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-content1 z-50 overflow-hidden">
      {/* Content */}
      <motion.div
        className="flex flex-col items-center gap-8"
        initial={{ opacity: 0, y: 16, scale: 0.88 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }}
      >
        {/* Logo */}
        <motion.div
          className="flex items-center gap-0"
          animate={{ opacity: [1, 0.45, 1] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.5,
          }}
        >
          <div className="font-semibold text-7xl tracking-tight italic select-none">
            <span className="text-foreground">Nest</span>
            <span className="text-[var(--app-link)]">plate</span>
          </div>
        </motion.div>

        {/* Dot loader — primary · muted · primary */}
        <div className="flex items-center gap-2.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className={`block w-2 h-2 rounded-full ${i === 1 ? 'bg-default-400' : 'bg-primary'}`}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.65, 1.35, 0.65] }}
              transition={{
                duration: 1.4,
                repeat: Infinity,
                delay: i * 0.22,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  )
}
