import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { House, ArrowRight, ArrowLeft, Clock, Tag, Check } from 'lucide-react'
import { BLOG_POSTS, getPost, getRelatedPosts, type BlogSection } from '@/lib/blog-posts'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://listops.io/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.publishedAt,
      authors: ['ListOps'],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
    alternates: {
      canonical: `https://listops.io/blog/${post.slug}`,
    },
  }
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-800',  border: 'border-amber-200' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200'  },
  purple: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200'},
  green:  { bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200' },
  rose:   { bg: 'bg-rose-50',   text: 'text-rose-800',   border: 'border-rose-200'  },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200'},
}

function RenderSection({ section }: { section: BlogSection }) {
  switch (section.type) {
    case 'h2':
      return (
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 mt-12 mb-4 leading-tight">
          {section.content}
        </h2>
      )
    case 'h3':
      return (
        <h3 className="font-display text-xl font-semibold text-slate-900 mt-8 mb-3">
          {section.content}
        </h3>
      )
    case 'p':
      return (
        <p className="text-slate-700 leading-[1.85] mb-5 text-[1.0625rem]">
          {section.content}
        </p>
      )
    case 'ul':
      return (
        <ul className="my-5 space-y-2.5">
          {section.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-slate-700 text-[1.0625rem]">
              <span className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-amber-700" strokeWidth={2.5} />
              </span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      )
    case 'ol':
      return (
        <ol className="my-5 space-y-3">
          {section.items?.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-slate-700 text-[1.0625rem]">
              <span className="w-6 h-6 bg-slate-900 text-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                {i + 1}
              </span>
              <span className="leading-relaxed flex-1">{item}</span>
            </li>
          ))}
        </ol>
      )
    case 'blockquote':
      return (
        <blockquote className="my-8 pl-6 border-l-4 border-amber-400 bg-amber-50 rounded-r-xl py-4 pr-4">
          <p className="text-slate-800 italic leading-relaxed text-[1.0625rem]">
            {section.content}
          </p>
        </blockquote>
      )
    case 'callout':
      return (
        <div className="my-8 bg-slate-900 text-white rounded-2xl p-6 sm:p-8">
          <p className="text-slate-200 leading-relaxed text-[1.0625rem]">
            {section.content}
          </p>
        </div>
      )
    case 'stat-grid':
      return (
        <div className="my-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {section.stats?.map((stat, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 text-center shadow-sm">
              <div className="font-display text-2xl font-bold text-slate-900 mb-1">{stat.value}</div>
              <div className="text-xs text-slate-500 leading-snug">{stat.label}</div>
            </div>
          ))}
        </div>
      )
    default:
      return null
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const related = getRelatedPosts(post.relatedSlugs)
  const catStyle = CATEGORY_STYLES[post.categoryColor] ?? CATEGORY_STYLES.amber

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    author: { '@type': 'Organization', name: 'ListOps' },
    publisher: {
      '@type': 'Organization',
      name: 'ListOps',
      url: 'https://listops.io',
    },
    url: `https://listops.io/blog/${post.slug}`,
    mainEntityOfPage: `https://listops.io/blog/${post.slug}`,
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-amber-100/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <House className="w-4 h-4 text-amber-400" />
            </div>
            <span className="font-display font-semibold text-slate-900 text-lg">ListOps</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 transition-colors">Sign In</Link>
            <Link href="/sign-up" className="inline-flex items-center gap-1.5 bg-slate-900 text-amber-50 text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">
              Try Free <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-24 pb-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-10">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Blog
          </Link>

          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
              <Tag className="w-3 h-3" />
              {post.category}
            </span>
            <span className="text-slate-400 text-sm flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />{post.readingTime}
            </span>
            <time className="text-slate-400 text-sm" dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </time>
          </div>

          <div className="text-6xl mb-6">{post.heroEmoji}</div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold text-slate-900 leading-tight mb-6">
            {post.title}
          </h1>

          <p className="text-lg text-slate-600 leading-relaxed border-b border-slate-200 pb-10">
            {post.description}
          </p>
        </div>
      </div>

      {/* Article body */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {post.content.map((section, i) => (
          <RenderSection key={i} section={section} />
        ))}
      </article>

      {/* In-article CTA */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-16">
        <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 grain relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent pointer-events-none" />
          <div className="relative">
            <div className="text-3xl mb-4">⚡</div>
            <h2 className="font-display text-2xl font-semibold text-white mb-3">
              {post.cta.heading}
            </h2>
            <p className="text-slate-400 mb-6 leading-relaxed">
              {post.cta.subtext}
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 bg-amber-400 text-slate-900 font-bold px-6 py-3.5 rounded-xl hover:bg-amber-300 transition-all text-sm"
            >
              {post.cta.buttonText}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Related posts */}
      {related.length > 0 && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-20">
          <h2 className="font-display text-xl font-semibold text-slate-900 mb-6">Keep reading</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {related.map((rel) => {
              const relCatStyle = CATEGORY_STYLES[rel.categoryColor] ?? CATEGORY_STYLES.amber
              return (
                <Link
                  key={rel.slug}
                  href={`/blog/${rel.slug}`}
                  className="group bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 hover:shadow-md transition-all duration-200"
                >
                  <div className="text-2xl mb-3">{rel.heroEmoji}</div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${relCatStyle.bg} ${relCatStyle.text} mb-2 inline-block`}>
                    {rel.category}
                  </span>
                  <h3 className="font-display font-semibold text-slate-900 text-sm leading-snug mb-1 group-hover:text-amber-700 transition-colors">
                    {rel.title}
                  </h3>
                  <span className="text-xs text-slate-400 flex items-center gap-1 mt-2">
                    <Clock className="w-3 h-3" />{rel.readingTime}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
              <House className="w-3 h-3 text-amber-400" />
            </div>
            <span className="text-sm font-semibold text-slate-600">ListOps</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <Link href="/blog" className="hover:text-slate-700 transition-colors">Blog</Link>
            <Link href="/pricing" className="hover:text-slate-700 transition-colors">Pricing</Link>
            <Link href="/privacy" className="hover:text-slate-700 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-700 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
