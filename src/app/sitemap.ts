import type { MetadataRoute } from 'next'
import { BLOG_POSTS } from '@/lib/blog-posts'
import { SITE_URL } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: Array<[string, number, MetadataRoute.Sitemap[number]['changeFrequency']]> = [
    ['', 1, 'weekly'], ['/features', 0.9, 'monthly'], ['/commercial', 0.9, 'monthly'], ['/pricing', 0.9, 'monthly'],
    ['/blog', 0.8, 'weekly'], ['/help', 0.6, 'monthly'], ['/about', 0.5, 'yearly'], ['/contact', 0.5, 'yearly'], ['/affiliates', 0.5, 'monthly'],
    ['/security', 0.4, 'yearly'], ['/privacy', 0.3, 'yearly'], ['/terms', 0.3, 'yearly'], ['/gdpr', 0.3, 'yearly'], ['/dmca', 0.2, 'yearly'],
  ]
  return [
    ...pages.map(([p, priority, changeFrequency]) => ({ url: `${SITE_URL}${p}`, changeFrequency, priority })),
    ...BLOG_POSTS.map(post => ({ url: `${SITE_URL}/blog/${post.slug}`, lastModified: new Date(post.updated ?? post.publishedAt), changeFrequency: 'monthly' as const, priority: 0.6 })),
  ]
}
