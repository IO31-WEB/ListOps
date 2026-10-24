import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/pricing',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/about',
  '/blog(.*)',
  '/contact(.*)',
  '/privacy',
  '/terms',
  '/security',
  '/gdpr',
  '/help(.*)',
  '/affiliates',
  '/l/(.*)',
  '/flyer/(.*)', // the page does its own auth: signed-in owner OR a short-lived signed print token (PDF renderer)
  '/api/l/(.*)', // public microsite lead form (honeypot + rate limits + consent inside the handler)
  '/api/photos/(.*)', // listing photos: public by design, key-validated in the handler
  '/api/webhooks/(.*)',
  '/api/contact',
  '/dmca',
  '/unsubscribe(.*)',
  '/age-blocked',
  '/account-closed',
  '/api/unsubscribe',
  '/api/csp-report',
  '/api/cron/(.*)', // protected by CRON_SECRET inside each handler
  '/api/commercial/data-push',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
