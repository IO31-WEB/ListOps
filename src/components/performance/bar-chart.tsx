import type { DayPoint } from '@/lib/performance/stats'

/** Dependency-free bar chart (server-renderable). Honest axes: starts at zero, labelled min/max, one <title> per bar. */
export function DailyBars({ points, color = '#d97706', label }: { points: DayPoint[]; color?: string; label: string }) {
  const max = Math.max(1, ...points.map(p => p.count))
  const W = 600, H = 140, PAD_L = 28, PAD_B = 22, innerW = W - PAD_L, innerH = H - PAD_B
  const bw = innerW / points.length
  const total = points.reduce((a, p) => a + p.count, 0)
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${total} in the last ${points.length} days`} className="w-full h-auto">
      <line x1={PAD_L} x2={W} y1={innerH} y2={innerH} stroke="#e2e8f0" />
      <text x={PAD_L - 4} y={10} textAnchor="end" fontSize="10" fill="#94a3b8">{max}</text>
      <text x={PAD_L - 4} y={innerH} textAnchor="end" fontSize="10" fill="#94a3b8">0</text>
      {points.map((p, i) => {
        const h = Math.round((p.count / max) * (innerH - 14))
        return (
          <g key={p.day}>
            <rect x={PAD_L + i * bw + 1} y={innerH - h} width={Math.max(1, bw - 2)} height={h} rx="2" fill={color} opacity={p.count ? 1 : 0.15}>
              <title>{`${fmt(p.day)}: ${p.count}`}</title>
            </rect>
          </g>
        )
      })}
      <text x={PAD_L} y={H - 6} fontSize="10" fill="#94a3b8">{fmt(points[0].day)}</text>
      <text x={W} y={H - 6} fontSize="10" fill="#94a3b8" textAnchor="end">{fmt(points[points.length - 1].day)}</text>
    </svg>
  )
}
