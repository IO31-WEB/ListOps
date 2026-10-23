import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://listops.io'
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard/', '/admin', '/onboarding', '/confirm-age', '/flyer/'] }],
    sitemap: `${base}/sitemap.xml`,
  }
}
