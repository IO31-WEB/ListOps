import { Star } from 'lucide-react'

interface TestimonialProps {
  quote: string
  name: string
  title: string
  avatar?: string
  rating?: number
}

export function Testimonial({ quote, name, title, rating = 5 }: TestimonialProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4">
      <div className="flex gap-0.5">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
        ))}
      </div>
      <p className="text-slate-700 text-sm leading-relaxed flex-1">"{quote}"</p>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-amber-400 font-bold text-sm font-display">
          {name.charAt(0)}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">{name}</div>
          <div className="text-xs text-slate-500">{title}</div>
        </div>
      </div>
    </div>
  )
}
