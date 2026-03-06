interface UsageMeterProps {
  used: number
  limit: number | null
  label: string
}

export function UsageMeter({ used, limit, label }: UsageMeterProps) {
  const pct = limit ? Math.min((used / limit) * 100, 100) : 0
  const isUnlimited = limit === null
  const isWarning = !isUnlimited && pct >= 80
  const isFull = !isUnlimited && pct >= 100

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-sm font-semibold text-slate-900">
          {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        {!isUnlimited && (
          <div
            className={`h-full rounded-full transition-all ${
              isFull ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-slate-900'
            }`}
            style={{ width: `${pct}%` }}
          />
        )}
        {isUnlimited && <div className="h-full bg-green-400 rounded-full w-full opacity-40" />}
      </div>
      {isFull && (
        <p className="text-xs text-red-600 mt-1">Limit reached. Upgrade to continue generating.</p>
      )}
    </div>
  )
}
