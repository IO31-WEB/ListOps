/** @type {import('next').NextConfig} */

// R2 public host for listing photos (e.g. assets.listops.io or *.r2.dev)
let r2Host = null
try {
  if (process.env.NEXT_PUBLIC_R2_PUBLIC_URL) r2Host = new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname
} catch {}

// CSP starts in REPORT-ONLY so nothing breaks while you watch Sentry/console for violations.
// After ~1 week with no legitimate violations, rename the header to "Content-Security-Policy".
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `img-src 'self' data: blob: https://img.clerk.com https://images.clerk.dev${r2Host ? ' https://' + r2Host : ''} https://*.r2.dev`,
  // Clerk, Stripe, PostHog and Sentry need these; Next inline scripts need 'unsafe-inline' unless you add nonces.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.listops.io https://js.stripe.com https://us-assets.i.posthog.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.listops.io https://api.stripe.com https://us.i.posthog.com https://us.posthog.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://*.clerk.accounts.dev",
  "worker-src 'self' blob:",
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy-Report-Only', value: csp },
]

const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'images.clerk.dev' },
      { protocol: 'https', hostname: '**.r2.dev' },
      ...(r2Host ? [{ protocol: 'https', hostname: r2Host }] : []),
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  // Packages only bundled server-side, not in the browser.
  serverExternalPackages: [
    '@neondatabase/serverless',
    '@sentry/nextjs',
    'posthog-node',
    'aws4fetch',
    '@sparticuz/chromium',
    'puppeteer-core',
    'resend',
  ],
  turbopack: {},
}

module.exports = nextConfig
