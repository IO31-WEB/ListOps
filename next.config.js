/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.simplyrets.com' },
      { protocol: 'https', hostname: '**.cloudflare.com' },
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'images.clerk.dev' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
  // Packages only bundled server-side, not in the browser.
  // These are optional — the app degrades gracefully if not installed.
  serverExternalPackages: [
    '@neondatabase/serverless',
    '@sentry/nextjs',
    'posthog-node',
    'aws4fetch',
    '@sparticuz/chromium',
    'puppeteer-core',
    'resend',
  ],
  turbopack: {
    // Tell Turbopack to treat optional server-only packages as external.
    // Prevents "Module not found" warnings for packages that are intentionally
    // not installed and are guarded by try/catch at runtime.
    resolveAlias: {
      '@sentry/nextjs': { external: '@sentry/nextjs' },
      '@sparticuz/chromium': { external: '@sparticuz/chromium' },
      'puppeteer-core': { external: 'puppeteer-core' },
    },
  },
}

module.exports = nextConfig
