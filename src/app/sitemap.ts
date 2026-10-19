import type { MetadataRoute } from 'next'
import { BLOG_POSTS } from '@/lib/blog-posts'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://listops.io'
  const staticPages = ['', '/pricing', '/about', '/blog', '/contact', '/help', '/privacy', '/terms', '/security', '/gdpr', '/affiliates']
  return [
    ...staticPages.map(p => ({ url: `${base}${p}`, changeFrequency: 'monthly' as const, priority: p === '' ? 1 : 0.6 })),
    ...BLOG_POSTS.map(post => ({ url: `${base}/blog/${post.slug}`, changeFrequency: 'monthly' as const, priority: 0.5 })),
  ]
}
