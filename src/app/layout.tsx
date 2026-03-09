import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { PostHogProvider } from '@/components/posthog-provider'
import { Toaster } from 'react-hot-toast'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: {
    default: 'CampaignAI — 6-Week Real Estate Marketing in One Click',
    template: '%s | CampaignAI',
  },
  description: 'Generate complete 6-week real estate marketing campaigns from your MLS listing ID. Facebook, Instagram, email, and print-ready flyers — all in about 60 seconds.',
  keywords: ['real estate marketing', 'MLS', 'real estate agent tools', 'listing marketing', 'AI real estate'],
  authors: [{ name: 'CampaignAI' }],
  creator: 'CampaignAI',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://campaignai.io',
    title: 'CampaignAI — 6-Week Real Estate Marketing in One Click',
    description: 'Generate complete 6-week real estate marketing campaigns from your MLS listing ID.',
    siteName: 'CampaignAI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CampaignAI',
    description: 'AI-powered real estate marketing campaigns from your MLS ID.',
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://campaignai.io'),
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
      appearance={{
        variables: {
          colorPrimary: '#0f172a',
          colorBackground: '#fef9f0',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          borderRadius: '0.625rem',
        },
        elements: {
          formButtonPrimary: 'bg-slate-900 hover:bg-slate-800 text-amber-50 font-medium',
          card: 'shadow-xl border border-amber-100',
          headerTitle: 'font-display text-slate-900',
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        </head>
        <body className="antialiased min-h-screen">
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
