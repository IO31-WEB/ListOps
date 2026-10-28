import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

const PRIVATE = ['/api/', '/dashboard/', '/admin', '/onboarding', '/confirm-age', '/flyer/', '/brochure/', '/invite/', '/join', '/sign-in', '/sign-up', '/q/', '/r/', '/a/', '/unsubscribe']

// Public marketing content is open to search and AI answer-engine crawlers; private and tokenized routes are not.
export default function robots(): MetadataRoute.Robots {
  const ai = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended']
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      { userAgent: ai, allow: ['/', '/llms.txt', '/llms-full.txt'], disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
