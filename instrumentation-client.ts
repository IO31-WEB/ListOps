import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
    // Browser noise that is never actionable
    ignoreErrors: ['ResizeObserver loop limit exceeded', 'Non-Error promise rejection captured'],
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
