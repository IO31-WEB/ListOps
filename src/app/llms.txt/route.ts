import { abs, planLines, PRODUCT_SUMMARY, LIMITS, SITE_NAME, BLOG_POSTS } from '@/lib/seo'

export const dynamic = 'force-static'

/** llms.txt: concise, factual site map for answer engines. Plans and seat counts are generated from lib/plans.ts. */
export function GET() {
  const body = [
    `# ${SITE_NAME}`,
    '',
    `> ${PRODUCT_SUMMARY}`,
    '',
    '## Key pages',
    `- [Features](${abs('/features')}): what is generated on each plan`,
    `- [Commercial real estate](${abs('/commercial')}): offering memorandum sections, teaser, one-pager, outreach, investment snapshot`,
    `- [Pricing](${abs('/pricing')}): plan comparison`,
    `- [Help & FAQ](${abs('/help')})`,
    `- [Blog](${abs('/blog')})`,
    `- [Full reference](${abs('/llms-full.txt')})`,
    '',
    '## Plans',
    ...planLines(),
    '',
    '## Limits',
    ...LIMITS.map(l => `- ${l}`),
    '',
    '## Blog',
    ...BLOG_POSTS.map(p => `- [${p.title}](${abs(`/blog/${p.slug}`)}): ${p.description}`),
    '',
  ].join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
}
