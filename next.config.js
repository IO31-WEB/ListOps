/** @type {import('next').NextConfig} */

// R2 public host for listing photos (e.g. assets.listops.io or *.r2.dev)
let r2Host = null
try {
  if (process.env.NEXT_PUBLIC_R2_PUBLIC_URL) r2Host = new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname
} catch {}

// ── Content-Security-Policy ───────────────────────────────────────────────────────────────────────
// Ships REPORT-ONLY by default: violations are reported to /api/csp-report (-> Sentry) and nothing is blocked.
// To ENFORCE: set CSP_ENFORCE=true in Vercel (Production) and redeploy — headers are computed at build time.
// To roll back instantly: remove the variable and redeploy (or "Promote" the previous deployment).
// See MIGRATION_AND_SECURITY.md ("Moving CSP to enforcing") for the test checklist.
const isProd = process.env.NODE_ENV === 'production'
const enforceCsp = process.env.CSP_ENFORCE === 'true'

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `img-src 'self' data: blob: https://img.clerk.com https://images.clerk.dev${r2Host ? ' https://' + r2Host : ''} https://*.r2.dev`,
  // Next.js needs 'unsafe-inline' for its bootstrap scripts unless nonces are used (see doc, "known limitation").
  // 'unsafe-eval' is only needed by the dev server's hot reload, so it is dropped in production builds.
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"} https://*.clerk.accounts.dev https://*.clerk.com https://clerk.listops.io https://js.stripe.com https://us-assets.i.posthog.com https://challenges.cloudflare.com`,
  // Fonts are self-hosted now, so no Google Fonts hosts are allowed anywhere.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.listops.io https://api.stripe.com https://us.i.posthog.com https://us.posthog.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://*.clerk.accounts.dev",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
  'report-uri /api/csp-report',
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: enforceCsp ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only', value: csp },
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
  // Blog slugs that dropped the year suffix: keep old inbound links and indexed URLs alive (308 = permanent).
  async redirects() {
    return [
      { source: '/blog/real-estate-marketing-tools-2025', destination: '/blog/real-estate-marketing-tools', permanent: true },
      { source: '/blog/real-estate-social-media-strategy-2025', destination: '/blog/real-estate-social-media-strategy', permanent: true },
    ]
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
