import { HeroUIProvider } from '@heroui/react'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { MotionConfig } from 'framer-motion'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'

import * as TanStackQueryProvider from '@/integrations/tanstack-query/root-provider'

// Import the generated route tree
import { routeTree } from '@/routeTree.gen'

import { ConfirmationRoot } from '@/components/shared/confirmation-root'
import { RouterPendingPlaceholder } from '@/components/layout/router-pending'
import { bindAuthQueryClient } from '@/lib/query/auth-cache'
import reportWebVitals from '@/reportWebVitals'
import '@/styles.css'

// Side-effect imports: applying persisted theme/background to <html> on first paint.
import '@/lib/stores/theme.store'

// Create a new router instance

const TanStackQueryProviderContext = TanStackQueryProvider.getContext()
bindAuthQueryClient(TanStackQueryProviderContext.queryClient)
const router = createRouter({
  routeTree,
  context: {
    ...TanStackQueryProviderContext,
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
  defaultPendingComponent: RouterPendingPlaceholder,
  defaultPendingMs: 200,
  defaultPendingMinMs: 300,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.getElementById('app')
// Google login is optional: only enabled when VITE_GOOGLE_CLIENT_ID is set.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  const app = (
    <TanStackQueryProvider.Provider {...TanStackQueryProviderContext}>
      <MotionConfig reducedMotion="user">
        <HeroUIProvider>
          <ConfirmationRoot />
          <RouterProvider router={router} />
        </HeroUIProvider>
      </MotionConfig>
    </TanStackQueryProvider.Provider>
  )
  root.render(
    <StrictMode>
      {GOOGLE_CLIENT_ID ? (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          {app}
        </GoogleOAuthProvider>
      ) : (
        app
      )}
    </StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
