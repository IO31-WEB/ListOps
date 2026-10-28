'use client'

/**
 * Toolbar for the printable pages (flyer, brochure). Built so it never gets in the way:
 *   • it sits in the page flow and sticks as one slim 52px row — never a tall fixed overlay on top of the document;
 *   • on phones the style/color options are folded behind an "Options" button (closed by default) and only the
 *     essentials stay visible: Back and Download PDF;
 *   • on larger screens the options are always visible beside the actions.
 * It is hidden when printing (the pages also hide `.no-print`).
 */
import { useState, type ReactNode } from 'react'
import { ArrowLeft, Download, Loader2, Printer, SlidersHorizontal } from 'lucide-react'

export function DocToolbar({ backUrl, title, busy, onDownload, children }: {
  backUrl: string
  title: string
  busy: boolean
  onDownload: () => void
  /** Option controls (styles, colors, dates…). Omit for documents without options. */
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-[52px] flex items-center gap-2 sm:gap-3">
        <a href={backUrl} aria-label="Back to campaign" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 p-2 -ml-2 rounded-lg">
          <ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Back</span>
        </a>
        <span className="flex-1 min-w-0 truncate text-sm font-semibold text-slate-900 text-center sm:text-left">{title}</span>
        {children && (
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
            className="sm:hidden inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50">
            <SlidersHorizontal className="w-4 h-4" />Options
          </button>
        )}
        <button type="button" onClick={onDownload} disabled={busy}
          className="inline-flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-3 sm:px-4 py-2 rounded-lg hover:bg-slate-800 disabled:opacity-60">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span>{busy ? 'Preparing…' : <>PDF<span className="hidden sm:inline"> download</span></>}</span>
        </button>
        <button type="button" onClick={() => window.print()} className="hidden sm:inline-flex items-center gap-1.5 border border-slate-300 text-slate-700 text-sm font-semibold px-3 py-2 rounded-lg hover:bg-slate-50">
          <Printer className="w-4 h-4" />Print
        </button>
      </div>
      {children && (
        <div className={`${open ? 'block' : 'hidden'} sm:block border-t border-slate-100 bg-slate-50/80`}>
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 flex flex-wrap items-center gap-x-5 gap-y-3">{children}</div>
        </div>
      )}
    </div>
  )
}
