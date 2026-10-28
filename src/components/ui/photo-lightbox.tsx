'use client'

import { useCallback, useEffect, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'

/** Thumbnail that never shows a broken-image icon: falls back to a neutral placeholder if the image fails. */
export function PhotoThumb({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className}`} role="img" aria-label={`${alt} (unavailable)`}>
        <Camera className="w-6 h-6 text-slate-300" />
      </div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} />
}

/**
 * Full-screen viewer. `index === null` means closed. Esc closes, ←/→ navigate; "Open full size" opens the
 * image in a new tab. Rendered by the page so thumbnails anywhere on it can open the same viewer.
 */
export function PhotoLightbox({ photos, index, onChange, label = 'Property photo' }: {
  photos: string[]; index: number | null; onChange: (i: number | null) => void; label?: string
}) {
  const open = index !== null && index >= 0 && index < photos.length
  const go = useCallback((d: number) => {
    if (index === null) return
    onChange((index + d + photos.length) % photos.length)
  }, [index, photos.length, onChange])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChange(null)
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, go, onChange])

  if (!open || index === null) return null
  const src = photos[index]
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`${label} ${index + 1} of ${photos.length}`}
      onClick={() => onChange(null)}>
      <div className="absolute top-4 right-4 flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <a href={src} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-white/15 hover:bg-white/25 px-3 py-2 rounded-lg">
          <ExternalLink className="w-3.5 h-3.5" />Open full size
        </a>
        <button type="button" onClick={() => onChange(null)} aria-label="Close"
          className="text-white bg-white/15 hover:bg-white/25 p-2 rounded-lg"><X className="w-4 h-4" /></button>
      </div>
      {photos.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={e => { e.stopPropagation(); go(-1) }}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white bg-white/15 hover:bg-white/25 p-2.5 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
          <button type="button" aria-label="Next photo" onClick={e => { e.stopPropagation(); go(1) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white bg-white/15 hover:bg-white/25 p-2.5 rounded-full"><ChevronRight className="w-5 h-5" /></button>
        </>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${label} ${index + 1}`} className="max-h-[88vh] max-w-[94vw] object-contain rounded-lg" onClick={e => e.stopPropagation()} />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70">{index + 1} / {photos.length}</div>
    </div>
  )
}
