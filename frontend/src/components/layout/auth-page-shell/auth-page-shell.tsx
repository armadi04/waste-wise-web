import { Card, CardBody } from '@heroui/react'
import { motion, useReducedMotion } from 'framer-motion'
import loginDayBg from '@/assets/images/login-day.webp'
import loginNightBg from '@/assets/images/login-night.webp'
import { useTheme } from '@/hooks/global'
import { useTimeZone } from '@/lib/stores/time-zone'
import { formatBusinessDate } from '@/lib/utils/format'

interface AuthPageShellProps {
  children: React.ReactNode
  /**
   * Shares the layout animation with the other auth cards so navigating
   * between them morphs the card. Disable for standalone screens such as the
   * verification and role gates.
   */
  morph?: boolean
}

/**
 * Full-screen, centered card layout shared by every auth page (login,
 * forgot/reset password, verify email, accept invite) and the gates.
 *
 * The illustration follows the theme — `login-night` in dark mode — and the
 * footer carries the copyright/developer line that used to sit in the split
 * layout's left column.
 */
export function AuthPageShell({ children, morph = true }: AuthPageShellProps) {
  useTimeZone((s) => s.timeZone)
  const { isDark } = useTheme()
  const reducedMotion = useReducedMotion()
  const background = isDark ? loginNightBg : loginDayBg

  return (
    <div
      className="relative flex min-h-screen w-full flex-col font-sans"
      style={{
        backgroundImage: `url(${background})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/10" />

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          layoutId={morph && !reducedMotion ? 'auth-card' : undefined}
          initial={reducedMotion ? false : { opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="w-full border-0 bg-content1 text-foreground shadow-none">
            <CardBody className="gap-6 p-8">{children}</CardBody>
          </Card>
        </motion.div>
      </main>

      <footer className="relative z-10 flex items-center justify-between px-6 pb-6 pt-4 text-xs text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
        <p>© {formatBusinessDate(new Date(), 'yyyy')} Nestplate Starter.</p>
        <a
          href="https://armadii.my.id"
          target="_blank"
          rel="noopener noreferrer"
          className="uppercase tracking-wide underline-offset-4 hover:underline focus-visible:rounded-small focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          developer
        </a>
      </footer>
    </div>
  )
}
