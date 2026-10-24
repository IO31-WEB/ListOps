import { ImageResponse } from 'next/og'

// Next.js auto-wires this as og:image AND twitter:image for every page.
export const alt = 'ListOps — 6-week real estate marketing, built from your listing and photos'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#0f172a', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 36, fontWeight: 700 }}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" fill="#f8fafc" stroke="#f8fafc" />
            <path d="M9 21V12h6v9" fill="#f59e0b" stroke="#f59e0b" />
          </svg>
          ListOps
        </div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, marginTop: 48, maxWidth: 980 }}>
          Six weeks of listing marketing. One click.
        </div>
        <div style={{ fontSize: 32, color: '#cbd5e1', marginTop: 32 }}>
          Social, email, print &amp; video scripts — written from your photos.
        </div>
      </div>
    ),
    { ...size }
  )
}
