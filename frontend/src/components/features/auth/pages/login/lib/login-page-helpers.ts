import { getRouteApi } from '@tanstack/react-router'
import { ServerCrash, TimerReset, TriangleAlert } from 'lucide-react'

export const routeApi = getRouteApi('/(auth)/login')

export const SSO_ERRORS = {
  not_configured: {
    icon: ServerCrash,
    title: 'Single sign-on is not configured',
    description:
      'This deployment has no identity provider set up yet. Sign in with your email and password, or ask an administrator to configure SSO.',
  },
  session_expired: {
    icon: TimerReset,
    title: 'Your sign-in session expired',
    description:
      'The login attempt took too long, or its cookies were cleared along the way. Start again from this page.',
  },
  exchange_failed: {
    icon: TriangleAlert,
    title: "We couldn't complete single sign-on",
    description:
      'The identity provider rejected the sign-in or returned something unexpected. Try again, and contact an administrator if it keeps happening.',
  },
} as const
