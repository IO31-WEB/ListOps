import { abs, planLines, PRODUCT_SUMMARY, LIMITS, SITE_NAME, BLOG_POSTS } from '@/lib/seo'
import { FEATURE_GATES } from '@/lib/plans'

export const dynamic = 'force-static'

/** Longer reference: plan matrix from FEATURE_GATES plus post summaries. */
export function GET() {
  const gates = Object.entries(FEATURE_GATES).map(([feature, plans]) => `- ${feature}: ${(plans as readonly string[]).join(', ')}`)
  const body = [
    `# ${SITE_NAME} full reference`,
    '',
    PRODUCT_SUMMARY,
    '',
    '## Plans and seats',
    ...planLines(),
    '',
    'Team invites: single-use, bound to the invited email, expire after 7 days. Teammates inherit the owner\'s plan only while the owner\'s subscription is active; pending invites count toward the seat limit.',
    '',
    '## Feature availability (plans that include each feature)',
    ...gates,
    '',
    '## Limits',
    ...LIMITS.map(l => `- ${l}`),
    '',
    '## Articles',
    ...BLOG_POSTS.flatMap(p => [`### ${p.title}`, `${abs(`/blog/${p.slug}`)} (updated ${p.updated ?? p.publishedAt})`, p.excerpt, '']),
  ].join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
