import { ToastProvider } from '@heroui/react'
import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useLocation,
  useRouter,
} from '@tanstack/react-router'
import axios from 'axios'
import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, lazy, useEffect } from 'react'

import type { QueryClient } from '@tanstack/react-query'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '@/components/shared/controls'
import { LottieAnimation } from '@/components/atoms/lottie-animation'
import { EmailVerificationGate } from '@/components/features/auth/components/email-verification-gate'
import { ImpersonationBanner } from '@/components/features/users/components/impersonation-banner'
import { Layout } from '@/components/layout/app-layout'
import { RouterPendingOverlay } from '@/components/layout/router-pending'
import { RoleSelectionGate } from '@/components/features/auth/components/role-selection-gate'
import { SocketBridge } from '@/components/providers/socket-bridge'
import { useTimeZoneSynchronization } from '@/hooks/global'

// Dev-only: in a production build `import.meta.env.DEV` folds to `false`, so the
// dynamic import is dead code and the devtools packages never reach the bundle.
const Devtools = import.meta.env.DEV
  ? lazy(() => import('@/integrations/devtools'))
  : () => null

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RootError,
})

function RootError({ error }: ErrorComponentProps) {
  const router = useRouter()
  const accessDenied =
    axios.isAxiosError(error) && error.response?.status === 403

  return (
    <main className="flex min-h-[80vh] w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold text-default-800">
        {accessDenied ? 'Access Denied' : 'Unable to load this page'}
      </h1>
      <p role="alert" className="max-w-md text-default-500">
        {accessDenied
          ? 'You do not have permission to access this page.'
          : 'Please check your connection and try again.'}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button color="primary" onPress={() => void router.invalidate()}>
          Try again
        </Button>
        <Button as={Link} to="/login" variant="flat">
          Go to sign in
        </Button>
      </div>
    </main>
  )
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full p-4">
      <div className="w-full max-w-md">
        <LottieAnimation name="notFound" />
      </div>
      <h1 className="text-2xl font-semibold text-default-800 mt-2">
        Oops! Page Not Found
      </h1>
      <p className="text-default-500 mb-6 text-center">
        We couldn't seem to find the page you are looking for.
      </p>
      <Button
        as={Link}
        to="/"
        color="primary"
        variant="flat"
        className="font-medium bg-[var(--app-selected-background)] text-primary"
      >
        Return to Dashboard
      </Button>
    </div>
  )
}

function RootComponent() {
  useTimeZoneSynchronization()
  const location = useLocation()
  useEffect(() => {
    if (!import.meta.env.DEV || !('serviceWorker' in navigator)) return
    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(
          registrations.map((registration) => registration.unregister()),
        ),
      )
  }, [])

  const isAuthPage = [
    '/login',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/accept-invite',
  ].includes(location.pathname)

  return (
    <>
      <SocketBridge />
      <ImpersonationBanner />
      <AnimatePresence mode="wait">
        {isAuthPage ? (
          <motion.div
            key="auth"
            exit={{
              opacity: 0,
              scale: 1.06,
              transition: { duration: 0.28, ease: [0.4, 0, 1, 1] },
            }}
          >
            <Outlet />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: { duration: 0.38, ease: [0, 0, 0.2, 1] },
            }}
          >
            <EmailVerificationGate>
              <RoleSelectionGate>
                <Layout>
                  <Outlet />
                </Layout>
              </RoleSelectionGate>
            </EmailVerificationGate>
          </motion.div>
        )}
      </AnimatePresence>
      <RouterPendingOverlay />
      <ToastProvider />
      <Suspense fallback={null}>
        <Devtools />
      </Suspense>
    </>
  )
}
