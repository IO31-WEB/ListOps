'use client'

interface ColorPickerProps {
  label: string
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-1 bg-white"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={e => {
            if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value)
          }}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div
          className="w-10 h-10 rounded-lg border border-slate-200 flex-shrink-0"
          style={{ background: value }}
        />
      </div>
    </div>
  )
}
