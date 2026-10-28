import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { PostHogProvider } from '@/components/posthog-provider'
import { Toaster } from 'react-hot-toast'
import localFont from 'next/font/local'
import { clerkAppearance } from '@/lib/clerk-appearance'
import { JsonLd } from '@/components/seo/json-ld'
import { organizationLd, websiteLd } from '@/lib/seo'
import '@/styles/globals.css'

// ── Self-hosted fonts (privacy) ───────────────────────────────────────────────
// All fonts are served from our own domain (files in src/app/fonts, SIL Open Font
// License — license files sit next to them). Nothing is requested from Google or any
// font CDN, so a visitor's IP / user-agent is never sent to a third party for fonts.
const fontDisplay = localFont({
  src: [
    { path: './fonts/playfair-display-latin-wght-normal.woff2', style: 'normal', weight: '400 900' },
    { path: './fonts/playfair-display-latin-wght-italic.woff2', style: 'italic', weight: '400 900' },
  ],
  variable: '--font-display',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
})
const fontBody = localFont({
  src: [
    { path: './fonts/dm-sans-latin-wght-normal.woff2', style: 'normal', weight: '100 1000' },
    { path: './fonts/dm-sans-latin-wght-italic.woff2', style: 'italic', weight: '100 1000' },
  ],
  variable: '--font-body',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})
const fontMono = localFont({
  src: [
    { path: './fonts/dm-mono-latin-400-normal.woff2', style: 'normal', weight: '400' },
    { path: './fonts/dm-mono-latin-500-normal.woff2', style: 'normal', weight: '500' },
  ],
  variable: '--font-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'monospace'],
})

export const metadata: Metadata = {
  title: {
    default: 'ListOps — 6-Week Real Estate Marketing in One Click',
    template: '%s | ListOps',
  },
  description: 'Generate a complete 6-week real estate marketing campaign from your listing details and photos. Facebook, Instagram, email, and print-ready flyers — all in about 2 minutes.',
  keywords: ['real estate marketing', 'listing marketing automation', 'real estate agent tools', 'commercial real estate marketing', 'offering memorandum', 'listing campaign generator'],
  authors: [{ name: 'ListOps' }],
  creator: 'ListOps',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://listops.io',
    title: 'ListOps — 6-Week Real Estate Marketing in One Click',
    description: 'Generate a complete 6-week real estate marketing campaign from your listing details and photos.',
    siteName: 'ListOps',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ListOps',
    description: 'AI-powered real estate marketing campaigns from your listing and photos.',
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://listops.io'),
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0f172a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={clerkAppearance}
    >
      <html lang="en" suppressHydrationWarning className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}>
        <body className="antialiased min-h-screen">
          <JsonLd data={[organizationLd(), websiteLd()]} />
          <PostHogProvider>
          {children}
          </PostHogProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#0f172a',
                color: '#fef9f0',
                borderRadius: '0.625rem',
                fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSize: '14px',
                border: '1px solid rgba(245,158,11,0.2)',
              },
              success: {
                iconTheme: { primary: '#f59e0b', secondary: '#0f172a' },
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  )
}
