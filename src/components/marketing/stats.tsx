interface StatProps {
  value: string
  label: string
  suffix?: string
}

function Stat({ value, label }: StatProps) {
  return (
    <div className="text-center">
      <div className="font-display text-4xl sm:text-5xl font-bold text-slate-900 mb-1">{value}</div>
      <div className="text-sm text-slate-500 font-medium">{label}</div>
    </div>
  )
}

export function StatsSection() {
  return (
    <section className="py-16 bg-white border-y border-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <Stat value="12,400+" label="Campaigns Generated" />
          <Stat value="2,100+" label="Active Agents" />
          <Stat value="58s" label="Avg. Generation Time" />
          <Stat value="4.9★" label="Average Rating" />
        </div>
      </div>
    </section>
  )
}
