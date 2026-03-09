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
  // Packages only bundled server-side, not in the browser
  serverExternalPackages: [
    '@neondatabase/serverless',
    '@sentry/nextjs',
    'posthog-node',
    'aws4fetch',
    '@sparticuz/chromium',
    'puppeteer-core',
    'resend',
  ],
  // Empty turbopack config silences the webpack/turbopack conflict warning
  turbopack: {},
}

module.exports = nextConfig
