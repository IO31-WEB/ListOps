import type { Metadata } from 'next'
import Link from 'next/link'
import { House, ArrowRight, Clock, Tag } from 'lucide-react'
import { BLOG_POSTS } from '@/lib/blog-posts'

export const metadata: Metadata = {
  title: 'Blog — Real Estate Marketing Guides & Best Practices',
  description: 'Practical guides on real estate listing marketing, social media strategy, email campaigns, and AI tools for agents who want to close more deals.',
  openGraph: {
    title: 'ListOps Blog — Real Estate Marketing Guides',
    description: 'Practical marketing guides for real estate agents. Social media, email, AI tools, listing copy, and everything in between.',
    url: 'https://listops.io/blog',
    type: 'website',
  },
  alternates: {
    canonical: 'https://listops.io/blog',
  },
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-800'  },
  blue:   { bg: 'bg-blue-100',   text: 'text-blue-800'   },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800' },
  green:  { bg: 'bg-green-100',  text: 'text-green-800'  },
  rose:   { bg: 'bg-rose-100',   text: 'text-rose-800'   },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
}

export default function BlogIndexPage() {
  const featured = BLOG_POSTS[0]
  const rest = BLOG_POSTS.slice(1)

  return (
    <div className="min-h-screen bg-[var(--cream)]">
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

      <div className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="mb-14 text-center">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full mb-4 uppercase tracking-widest">
              <Tag className="w-3.5 h-3.5" />
              The ListOps Blog
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-semibold text-slate-900 mb-4">
              Real estate marketing,<br className="hidden sm:block" />{' '}
              <em className="text-amber-600">done right</em>
            </h1>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Practical guides for agents who want to spend less time on marketing and more time closing.
            </p>
          </div>

          {/* Featured post */}
          <Link
            href={`/blog/${featured.slug}`}
            className="group block bg-slate-900 rounded-3xl overflow-hidden mb-10 hover:shadow-2xl transition-all duration-300"
          >
            <div className="p-8 sm:p-12 flex flex-col sm:flex-row gap-8 items-start">
              <div className="w-20 h-20 bg-amber-400/20 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0">
                {featured.heroEmoji}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300`}>
                    {featured.category}
                  </span>
                  <span className="text-slate-500 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />{featured.readingTime}
                  </span>
                  <span className="text-slate-600 text-xs">{new Date(featured.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white mb-3 group-hover:text-amber-300 transition-colors">
                  {featured.title}
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-5 max-w-2xl">{featured.excerpt}</p>
                <span className="inline-flex items-center gap-2 text-amber-400 text-sm font-semibold group-hover:gap-3 transition-all">
                  Read the guide <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </Link>

          {/* Article grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((post) => {
              const catStyle = CATEGORY_STYLES[post.categoryColor] ?? CATEGORY_STYLES.amber
              return (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-lg transition-all duration-200 flex flex-col"
                >
                  {/* Card top accent */}
                  <div className="h-1.5 bg-gradient-to-r from-amber-400 to-amber-200" />

                  <div className="p-6 flex flex-col flex-1">
                    <div className="text-3xl mb-4">{post.heroEmoji}</div>

                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${catStyle.bg} ${catStyle.text}`}>
                        {post.category}
                      </span>
                      <span className="text-slate-400 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />{post.readingTime}
                      </span>
                    </div>

                    <h2 className="font-display text-lg font-semibold text-slate-900 mb-2 group-hover:text-amber-700 transition-colors leading-snug">
                      {post.title}
                    </h2>
                    <p className="text-sm text-slate-500 leading-relaxed flex-1 mb-5 line-clamp-3">
                      {post.excerpt}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                      <span className="text-xs text-slate-400">
                        {new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className="text-xs font-semibold text-amber-600 flex items-center gap-1 group-hover:gap-2 transition-all">
                        Read <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Bottom CTA */}
          <div className="mt-20 bg-slate-900 rounded-3xl p-10 text-center grain relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <div className="text-4xl mb-4">⚡</div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white mb-3">
                Stop writing. Start closing.
              </h2>
              <p className="text-slate-400 mb-8 max-w-lg mx-auto">
                ListOps turns your MLS listing ID into a complete 6-week marketing campaign in about 90 seconds. Every channel. Every format. Done.
              </p>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 bg-amber-400 text-slate-900 font-bold px-8 py-4 rounded-xl hover:bg-amber-300 transition-all text-sm"
              >
                Try Free — No Credit Card Required
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

        </div>
      </div>

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
            <Link href="/pricing" className="hover:text-slate-700 transition-colors">Pricing</Link>
            <Link href="/about" className="hover:text-slate-700 transition-colors">About</Link>
            <Link href="/privacy" className="hover:text-slate-700 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-700 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
