import * as Sentry from '@sentry/nextjs'

export async function register() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return // no DSN -> Sentry fully disabled (safe in dev)
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    sendDefaultPii: false, // never attach IPs / cookies / auth headers automatically
    beforeSend(event) {
      // Belt and braces: strip request bodies and cookies (listing data, emails, etc.)
      if (event.request) {
        delete event.request.data
        delete event.request.cookies
        if (event.request.headers) {
          delete event.request.headers['cookie']
          delete event.request.headers['authorization']
        }
      }
      return event
    },
  })
}

// Captures errors thrown in Server Components, route handlers and middleware.
export const onRequestError = Sentry.captureRequestError
