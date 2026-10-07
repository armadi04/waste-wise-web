import { Card, CardBody } from '@heroui/react'
import { motion } from 'framer-motion'
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
          layoutId={morph ? 'auth-card' : undefined}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Card className="w-full border-0 bg-white/80 text-foreground shadow-2xl backdrop-blur-md dark:bg-black/55">
            <CardBody className="gap-6 p-8">{children}</CardBody>
          </Card>
        </motion.div>
      </main>

      <footer className="relative z-10 flex items-center justify-between px-6 pb-6 text-xs text-white/80 drop-shadow-sm">
        <p>© {formatBusinessDate(new Date(), 'yyyy')} Nestplate Starter.</p>
        <a
          href="https://armadii.my.id"
          target="_blank"
          rel="noopener noreferrer"
          className="uppercase tracking-wide transition-colors hover:text-white"
        >
          developer
        </a>
      </footer>
    </div>
  )
}
