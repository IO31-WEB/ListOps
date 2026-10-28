/**
 * SEO + AI-discoverability helpers. Pure and server-safe: one place for the site URL, page metadata and JSON-LD,
 * so titles/descriptions/canonicals/OG stay consistent and structured data is generated from PLANS (never hand-typed prices).
 */
import type { Metadata } from 'next'
import { PLANS } from './plans'
import { BLOG_POSTS, type BlogPost } from './blog-posts'

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://listops.io').replace(/\/$/, '')
export const SITE_NAME = 'ListOps'
export const SITE_TAGLINE = 'Listing marketing campaigns for real estate agents and commercial brokers'

/** One-paragraph, factual product definition. Reused by metadata, JSON-LD, llms.txt and the features page. */
export const PRODUCT_SUMMARY =
  'ListOps turns the details and photos you enter for a listing into a complete 6-week marketing campaign: social posts, email, MLS-ready description, print flyers, a listing microsite and more. ' +
  'Commercial and Brokerage plans add offering memorandum sections, a teaser, a one-pager, investor outreach drafts and a zero-data-cost investment snapshot for commercial real estate.'

/** What ListOps does NOT do. Stated on public pages so answer engines do not invent capabilities. */
export const LIMITS = [
  'ListOps does not connect to an MLS feed and does not scrape listing portals; you enter or confirm listing details.',
  'ListOps does not pull comparable sales, market statistics or valuation data. It never invents comps or ROI figures.',
  'ListOps drafts marketing content; the agent or broker reviews it before publishing. It is not legal, tax or investment advice.',
]

export const abs = (path = '/') => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

interface PageSeo { title: string; description: string; path: string; type?: 'website' | 'article'; noindex?: boolean }

/** Metadata for a public page. `title` is the page title WITHOUT the site suffix (layout template appends "| ListOps"). */
export function pageMetadata({ title, description, path, type = 'website', noindex }: PageSeo): Metadata {
  const url = abs(path)
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type, url, title: `${title} | ${SITE_NAME}`, description, siteName: SITE_NAME, locale: 'en_US' },
    twitter: { card: 'summary_large_image', title: `${title} | ${SITE_NAME}`, description },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  }
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  }
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
}

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#org`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: abs('/icon.svg'),
    description: SITE_TAGLINE,
  }
}

export function websiteLd() {
  return { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME, publisher: { '@id': `${SITE_URL}/#org` } }
}

/** SoftwareApplication with one Offer per paid/free plan, generated from PLANS so prices can never drift. */
export function softwareLd() {
  const offers = PLANS.filter(p => p.monthlyPrice !== null).map(p => ({
    '@type': 'Offer',
    name: `${p.name} plan`,
    price: String(p.monthlyPrice),
    priceCurrency: 'USD',
    url: abs('/pricing'),
    description: `${p.tagline}. ${p.maxAgents} team seat${p.maxAgents === 1 ? '' : 's'}.`,
    priceSpecification: { '@type': 'UnitPriceSpecification', price: String(p.monthlyPrice), priceCurrency: 'USD', billingDuration: 'P1M' },
  }))
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description: PRODUCT_SUMMARY,
    offers,
  }
}

export function blogPostingLd(post: BlogPost) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updated ?? post.publishedAt,
    mainEntityOfPage: abs(`/blog/${post.slug}`),
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@id': `${SITE_URL}/#org` },
    articleSection: post.category,
  }
}

/** Plain-text/Markdown plan matrix for llms.txt — generated from PLANS and SEAT_LIMITS via PLANS.maxAgents. */
export function planLines(): string[] {
  return PLANS.map(p => {
    const price = p.monthlyPrice === null ? 'custom' : p.monthlyPrice === 0 ? 'free' : `$${p.monthlyPrice}/month`
    const camps = p.campaignsPerMonth === 'unlimited' ? 'unlimited campaigns' : `${p.campaignsPerMonth} campaigns/month`
    return `- ${p.name} (${price}): ${camps}, ${p.maxAgents} team seat${p.maxAgents === 1 ? '' : 's'}. ${p.tagline}.`
  })
}

export { BLOG_POSTS }
