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
  // Packages that should only be bundled for server-side, not browser
  serverExternalPackages: [
    '@neondatabase/serverless',
    '@sentry/nextjs',
    'posthog-node',
    'aws4fetch',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Tell webpack to ignore these optional packages if not installed
      config.externals = config.externals || []
      config.externals.push(
        '@sparticuz/chromium',
        'puppeteer-core',
      )
    }
    return config
  },
}

module.exports = nextConfig
