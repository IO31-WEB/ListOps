/**
 * The ONE ListOps mark (house). Mirrors /public/logo-house.svg and app/icon.svg (favicon) — change all three together.
 * `tone="light"` is for dark backgrounds (the house body flips to near-white; the amber door stays).
 */
export function LogoMark({ className = 'w-8 h-8', tone = 'dark' }: { className?: string; tone?: 'dark' | 'light' }) {
  const body = tone === 'light' ? '#f8fafc' : '#0f172a'
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="ListOps">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" fill={body} stroke={body} />
      <path d="M9 21V12h6v9" fill="#f59e0b" stroke="#f59e0b" />
      <rect x="9" y="12" width="6" height="9" rx="0.5" fill="#f59e0b" stroke="none" />
    </svg>
  )
}
