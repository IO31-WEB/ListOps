/**
 * Visual-kit templates. Each function returns a satori-compatible element tree (flexbox only — every element
 * with more than one child sets display:flex; no grid, no filters). Helper pieces are plain functions that are
 * CALLED (not used as <Components/>) because satori only understands host elements.
 *
 * Type hierarchy relies on size, color and letter-spacing: the built-in renderer font has one weight.
 */
import type { CSSProperties, ReactElement } from 'react'
import type { KitData } from './data'
import { readableOn } from '@/lib/color-schemes'
import { KIT_CATALOG, type KitKind } from './catalog'

type S = CSSProperties
const flex = (s: S = {}): S => ({ display: 'flex', ...s })
const SANS = 'sans-serif'

const BADGE_TEXT = { justListed: 'Just Listed', openHouse: 'Open House', priceReduced: 'Price Improvement' } as const

// ── Pieces ─────────────────────────────────────────────────────

function photoBg(d: KitData, w: number, h: number, top = 0, left = 0): ReactElement {
  return d.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={d.photo} width={w} height={h} style={{ position: 'absolute', top, left, width: w, height: h, objectFit: 'cover' }} />
  ) : (
    <div style={{ position: 'absolute', top, left, width: w, height: h, display: 'flex', backgroundImage: `linear-gradient(135deg, ${d.primary}, #0b1220)` }} />
  )
}

function gradient(w: number, h: number, top: number, css: string): ReactElement {
  return <div style={{ position: 'absolute', top, left: 0, width: w, height: h, display: 'flex', backgroundImage: css }} />
}

function frame(w: number, h: number, accent: string, inset = 26): ReactElement {
  return <div style={{ position: 'absolute', top: inset, left: inset, width: w - inset * 2, height: h - inset * 2, display: 'flex', border: `2px solid ${accent}`, opacity: 0.7 }} />
}

function badge(text: string, d: KitData, size = 26): ReactElement {
  return (
    <div style={flex({ alignItems: 'center', background: d.accent, color: readableOn(d.accent), fontSize: size, letterSpacing: size * 0.22, textTransform: 'uppercase', padding: `${size * 0.5}px ${size * 0.9}px`, fontFamily: SANS })}>
      {text}
    </div>
  )
}

function stats(d: KitData, color: string, size = 30, muted = 'rgba(255,255,255,0.6)'): ReactElement | null {
  const items: Array<[string, string]> = []
  if (d.beds) items.push([String(d.beds), 'Beds'])
  if (d.baths) items.push([String(d.baths), 'Baths'])
  if (d.sqft) items.push([d.sqft, 'Sq Ft'])
  if (d.yearBuilt) items.push([String(d.yearBuilt), 'Built'])
  if (!items.length) return null
  return (
    <div style={flex({ alignItems: 'center' })}>
      {items.map(([v, label], i) => (
        <div key={label} style={flex({ alignItems: 'center' })}>
          {i > 0 && <div style={{ width: 2, height: size * 1.6, background: d.accent, opacity: 0.6, margin: `0 ${size * 0.8}px`, display: 'flex' }} />}
          <div style={flex({ flexDirection: 'column' })}>
            <div style={{ fontSize: size, color, display: 'flex' }}>{v}</div>
            <div style={{ fontSize: size * 0.42, color: muted, letterSpacing: size * 0.1, textTransform: 'uppercase', display: 'flex', marginTop: 2 }}>{label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Agent strip: headshot, name/contact, logos. `bg` is the strip background; text color adapts to it. */
function agentBar(d: KitData, w: number, h: number, bg: string): ReactElement {
  const fg = readableOn(bg)
  const muted = fg === '#ffffff' ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.65)'
  const contact = [d.phone, d.email].filter(Boolean).join('   ·   ')
  const sub = [d.agentTitle, d.brokerage].filter(Boolean).join('  ·  ')
  const pad = Math.round(h * 0.2)
  return (
    <div style={flex({ width: w, height: h, background: bg, alignItems: 'center', justifyContent: 'space-between', padding: `0 ${pad * 1.6}px` })}>
      <div style={flex({ alignItems: 'center', flex: 1 })}>
        {d.headshot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.headshot} width={h * 0.62} height={h * 0.62} style={{ width: h * 0.62, height: h * 0.62, borderRadius: h, objectFit: 'cover', border: `3px solid ${d.accent}`, marginRight: pad }} />
        )}
        <div style={flex({ flexDirection: 'column' })}>
          {d.agentName && <div style={{ display: 'flex', fontSize: h * 0.2, color: fg }}>{d.agentName}</div>}
          {sub && <div style={{ display: 'flex', fontSize: h * 0.115, color: muted, marginTop: 4, letterSpacing: 1 }}>{sub}</div>}
          {contact && <div style={{ display: 'flex', fontSize: h * 0.135, color: fg, marginTop: 6 }}>{contact}</div>}
        </div>
      </div>
      <div style={flex({ alignItems: 'center' })}>
        {d.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.logo} height={h * 0.5} style={{ height: h * 0.5, maxWidth: h * 1.6, objectFit: 'contain', marginLeft: pad }} />
        )}
        {d.brokerageLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.brokerageLogo} height={h * 0.46} style={{ height: h * 0.46, maxWidth: h * 1.5, objectFit: 'contain', marginLeft: pad }} />
        )}
      </div>
    </div>
  )
}

function watermark(d: KitData, w: number, h: number): ReactElement | null {
  if (!d.watermark) return null
  return (
    <div style={{ position: 'absolute', right: 20, top: h - 48, display: 'flex', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: Math.max(16, w * 0.016), padding: '6px 14px', borderRadius: 20, fontFamily: SANS }}>
      Made with ListOps
    </div>
  )
}

function disclaimerLine(d: KitData, w: number, bottom: number): ReactElement | null {
  if (!d.disclaimer) return null
  return (
    <div style={{ position: 'absolute', left: 64, top: bottom, width: w - 128, height: 20, display: 'flex', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>
      {d.disclaimer}
    </div>
  )
}

function priceBlock(d: KitData, size: number, kind: KitKind): ReactElement {
  if (kind === 'price-reduced' && d.oldPrice) {
    return (
      <div style={flex({ flexDirection: 'column' })}>
        <div style={{ display: 'flex', fontSize: size * 0.42, color: 'rgba(255,255,255,0.6)', textDecoration: 'line-through' }}>{d.oldPrice}</div>
        <div style={{ display: 'flex', fontSize: size, color: d.accent, marginTop: 2 }}>{d.price}</div>
      </div>
    )
  }
  return <div style={{ display: 'flex', fontSize: size, color: d.accent }}>{d.price}</div>
}

// ── Layouts ────────────────────────────────────────────────────

/** Full-bleed photo, address + price over a dark gradient, agent strip. Used for ig-square / price-reduced. */
function photoHero(d: KitData, kind: KitKind): ReactElement {
  const { width: w, height: h, badge: b } = KIT_CATALOG[kind]
  const bar = Math.round(h * 0.14)
  return (
    <div style={flex({ width: w, height: h, position: 'relative', flexDirection: 'column', fontFamily: SANS, background: d.primary })}>
      {photoBg(d, w, h)}
      {gradient(w, h, 0, 'linear-gradient(180deg, rgba(8,15,30,0.35) 0%, rgba(8,15,30,0.05) 28%, rgba(8,15,30,0.55) 58%, rgba(8,15,30,0.94) 100%)')}
      {frame(w, h - bar, d.accent)}
      <div style={flex({ position: 'absolute', top: 56, left: 56 })}>{badge(BADGE_TEXT[b], d)}</div>
      <div style={flex({ position: 'absolute', left: 64, right: 64, bottom: bar + 52, flexDirection: 'column' })}>
        {priceBlock(d, 84, kind)}
        <div style={{ display: 'flex', fontSize: 52, color: '#fff', marginTop: 14, lineHeight: 1.1 }}>{d.street}</div>
        <div style={{ display: 'flex', fontSize: 28, color: 'rgba(255,255,255,0.75)', marginTop: 8, letterSpacing: 2, textTransform: 'uppercase' }}>{d.cityState}</div>
        <div style={flex({ marginTop: 34 })}>{stats(d, '#fff', 38)}</div>
      </div>
      {disclaimerLine(d, w, h - bar - 34)}
      <div style={flex({ position: 'absolute', left: 0, top: h - bar })}>{agentBar(d, w, bar, d.primary)}</div>
      {watermark(d, w, h - bar)}
    </div>
  )
}

function story(d: KitData): ReactElement {
  const { width: w, height: h } = KIT_CATALOG['ig-story']
  // Instagram UI covers roughly the top 250px and bottom 250px of a Story: keep key text between them.
  // Vertical budget (no overlaps): photo 0–1100 · info panel 1100–1590 · agent bar 1590–1800 · quiet safe zone 1800–1920.
  const photoH = 1100, panelTop = photoH, barTop = 1590, bar = 210
  return (
    <div style={flex({ width: w, height: h, position: 'relative', flexDirection: 'column', fontFamily: SANS, background: d.primary })}>
      {photoBg(d, w, photoH)}
      {gradient(w, photoH, 0, 'linear-gradient(180deg, rgba(8,15,30,0.4) 0%, rgba(8,15,30,0) 30%, rgba(8,15,30,0.0) 70%, rgba(8,15,30,0.85) 100%)')}
      <div style={flex({ position: 'absolute', top: 290, left: 64 })}>{badge(BADGE_TEXT.justListed, d, 34)}</div>
      <div style={{ position: 'absolute', top: panelTop, left: 0, width: w, height: barTop - panelTop, display: 'flex', overflow: 'hidden', background: d.primary, flexDirection: 'column', padding: '44px 72px 0' }}>
        <div style={{ display: 'flex', width: 90, height: 4, background: d.rule ?? d.accent }} />
        <div style={{ display: 'flex', fontSize: 60, color: '#fff', marginTop: 24, lineHeight: 1.1 }}>{d.street}</div>
        <div style={{ display: 'flex', fontSize: 28, color: 'rgba(255,255,255,0.7)', marginTop: 8, letterSpacing: 3, textTransform: 'uppercase' }}>{d.cityState}</div>
        <div style={flex({ marginTop: 24 })}>{priceBlock(d, 84, 'ig-story')}</div>
        <div style={flex({ marginTop: 24 })}>{stats(d, '#fff', 40)}</div>
      </div>
      <div style={flex({ position: 'absolute', left: 0, top: barTop })}>{agentBar(d, w, bar, d.accent)}</div>
      {disclaimerLine(d, w, barTop + bar + 16)}
      {watermark(d, w, h - 12)}
    </div>
  )
}

/** Full-photo Story: the picture does the talking, with a lower-third kept clear of the Story UI. */
function story2(d: KitData): ReactElement {
  const { width: w, height: h } = KIT_CATALOG['ig-story-2']
  const contact = [d.agentName, d.phone].filter(Boolean).join('   ·   ')
  return (
    <div style={flex({ width: w, height: h, position: 'relative', flexDirection: 'column', fontFamily: SANS, background: d.primary })}>
      {photoBg(d, w, h)}
      {gradient(w, 900, 780, 'linear-gradient(180deg, rgba(8,15,30,0) 0%, rgba(8,15,30,0.7) 55%, rgba(8,15,30,0.95) 100%)')}
      {gradient(w, 420, 0, 'linear-gradient(180deg, rgba(8,15,30,0.5) 0%, rgba(8,15,30,0) 100%)')}
      <div style={flex({ position: 'absolute', top: 290, left: 64 })}>{badge(BADGE_TEXT.justListed, d, 34)}</div>
      <div style={flex({ position: 'absolute', left: 72, right: 72, top: 1230, flexDirection: 'column' })}>
        <div style={{ display: 'flex', width: 90, height: 4, background: d.rule ?? d.accent }} />
        <div style={{ display: 'flex', fontSize: 100, color: d.accent, marginTop: 26 }}>{d.price}</div>
        <div style={{ display: 'flex', fontSize: 62, color: '#fff', marginTop: 12, lineHeight: 1.1 }}>{d.street}</div>
        <div style={{ display: 'flex', fontSize: 28, color: 'rgba(255,255,255,0.78)', marginTop: 8, letterSpacing: 3, textTransform: 'uppercase' }}>{d.cityState}</div>
        <div style={flex({ marginTop: 28 })}>{stats(d, '#fff', 40)}</div>
        {contact && <div style={{ display: 'flex', fontSize: 30, color: '#fff', marginTop: 34 }}>{contact}</div>}
      </div>
      {disclaimerLine(d, w, 1790)}
      {watermark(d, w, h - 12)}
    </div>
  )
}

/** Portrait feed post (4:5): large photo, details panel, agent strip. */
function igFeature(d: KitData): ReactElement {
  const { width: w, height: h } = KIT_CATALOG['ig-feature']
  const photoH = 860, bar = 140, panelH = h - photoH - bar
  return (
    <div style={flex({ width: w, height: h, position: 'relative', flexDirection: 'column', fontFamily: SANS, background: d.primary })}>
      {photoBg(d, w, photoH)}
      {gradient(w, 300, 0, 'linear-gradient(180deg, rgba(8,15,30,0.45) 0%, rgba(8,15,30,0) 100%)')}
      <div style={flex({ position: 'absolute', top: 48, left: 48 })}>{badge(BADGE_TEXT.justListed, d, 26)}</div>
      <div style={{ position: 'absolute', top: photoH, left: 0, width: w, height: panelH, display: 'flex', overflow: 'hidden', background: d.primary, flexDirection: 'column', padding: '30px 56px 0' }}>
        <div style={flex({ alignItems: 'flex-end', justifyContent: 'space-between' })}>
          <div style={flex({ flexDirection: 'column' })}>
            <div style={{ display: 'flex', fontSize: 50, color: '#fff', lineHeight: 1.1 }}>{d.street}</div>
            <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.72)', marginTop: 6, letterSpacing: 3, textTransform: 'uppercase' }}>{d.cityState}</div>
          </div>
          <div style={{ display: 'flex', fontSize: 62, color: d.accent }}>{d.price}</div>
        </div>
        <div style={flex({ marginTop: 22 })}>{stats(d, '#fff', 32)}</div>
      </div>
      {disclaimerLine(d, w, photoH + panelH - 28)}
      <div style={flex({ position: 'absolute', left: 0, top: h - bar })}>{agentBar(d, w, bar, d.accent)}</div>
      {watermark(d, w, h - bar)}
    </div>
  )
}

function tile(src: string, w: number, h: number, top: number, left: number, key?: number): ReactElement {
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={key} src={src} width={w} height={h} style={{ position: 'absolute', top, left, width: w, height: h, objectFit: 'cover' }} />
}

/** One large photo plus up to three smaller ones (whatever the listing has), then address, price and agent. */
function igCollage(d: KitData): ReactElement {
  const { width: w, height: h } = KIT_CATALOG['ig-collage']
  const photos = [d.photo, ...d.morePhotos].filter((p): p is string => !!p)
  const gridH = 760, gap = 8, bar = 120, infoH = h - gridH - bar
  const rightW = 432, bigW = photos.length > 1 ? w - rightW - gap : w
  const small = photos.slice(1, 4)
  const smallH = small.length === 1 ? gridH : small.length === 2 ? (gridH - gap) / 2 : (gridH - gap * 2) / 3
  return (
    <div style={flex({ width: w, height: h, position: 'relative', flexDirection: 'column', fontFamily: SANS, background: d.primary })}>
      {photos[0] ? tile(photos[0], bigW, gridH, 0, 0) : photoBg(d, w, gridH)}
      {small.map((src, i) => tile(src, rightW, smallH, i * (smallH + gap), bigW + gap, i))}
      <div style={flex({ position: 'absolute', top: 40, left: 40 })}>{badge(BADGE_TEXT.justListed, d, 24)}</div>
      <div style={{ position: 'absolute', top: gridH, left: 0, width: w, height: infoH, display: 'flex', overflow: 'hidden', background: d.primary, alignItems: 'center', justifyContent: 'space-between', padding: '0 56px 12px' }}>
        <div style={flex({ flexDirection: 'column' })}>
          <div style={{ display: 'flex', fontSize: 44, color: '#fff', lineHeight: 1.1 }}>{d.street}</div>
          <div style={{ display: 'flex', fontSize: 20, color: 'rgba(255,255,255,0.72)', marginTop: 6, letterSpacing: 3, textTransform: 'uppercase' }}>{d.cityState}</div>
        </div>
        <div style={flex({ flexDirection: 'column', alignItems: 'flex-end' })}>
          <div style={{ display: 'flex', fontSize: 56, color: d.accent }}>{d.price}</div>
          <div style={flex({ marginTop: 8 })}>{stats(d, '#fff', 22)}</div>
        </div>
      </div>
      {disclaimerLine(d, w, gridH + infoH - 24)}
      <div style={flex({ position: 'absolute', left: 0, top: h - bar })}>{agentBar(d, w, bar, d.accent)}</div>
      {watermark(d, w, h - bar)}
    </div>
  )
}

function fbPost(d: KitData): ReactElement {
  const { width: w, height: h } = KIT_CATALOG['fb-post']
  const left = 690
  return (
    <div style={flex({ width: w, height: h, position: 'relative', fontFamily: SANS, background: d.primary })}>
      {photoBg(d, left, h)}
      <div style={flex({ position: 'absolute', left, top: 0, width: w - left, height: h, flexDirection: 'column', padding: '44px 44px 0 48px', background: d.primary })}>
        <div style={flex({ alignSelf: 'flex-start' })}>{badge(BADGE_TEXT.justListed, d, 20)}</div>
        <div style={flex({ marginTop: 28 })}>{priceBlock(d, 62, 'fb-post')}</div>
        <div style={{ display: 'flex', fontSize: 34, color: '#fff', marginTop: 12, lineHeight: 1.12 }}>{d.street}</div>
        <div style={{ display: 'flex', fontSize: 19, color: 'rgba(255,255,255,0.7)', marginTop: 8, letterSpacing: 2, textTransform: 'uppercase' }}>{d.cityState}</div>
        <div style={flex({ marginTop: 26 })}>{stats(d, '#fff', 26)}</div>
        <div style={{ display: 'flex', marginTop: 'auto' }}>{agentBar(d, w - left - 92, 120, 'transparent' as string)}</div>
      </div>
      <div style={{ position: 'absolute', left: left - 6, top: 0, width: 6, height: h, display: 'flex', background: d.accent }} />
      {watermark(d, w, h)}
    </div>
  )
}

function openHouse(d: KitData): ReactElement {
  const { width: w, height: h } = KIT_CATALOG['open-house']
  const photoH = 540, bar = 150
  return (
    <div style={flex({ width: w, height: h, position: 'relative', fontFamily: SANS, background: d.primary })}>
      {photoBg(d, w, photoH)}
      {gradient(w, photoH, 0, 'linear-gradient(180deg, rgba(8,15,30,0.25) 0%, rgba(8,15,30,0) 40%, rgba(8,15,30,0.6) 100%)')}
      <div style={flex({ position: 'absolute', top: photoH, left: 0, width: w, height: h - photoH - bar, background: d.primary, flexDirection: 'column', alignItems: 'center', padding: '34px 60px 0' })}>
        <div style={{ display: 'flex', fontSize: 30, color: d.accent, letterSpacing: 10, textTransform: 'uppercase' }}>You&apos;re invited</div>
        <div style={{ display: 'flex', fontSize: 110, color: '#fff', letterSpacing: 6, textTransform: 'uppercase', marginTop: 6 }}>Open House</div>
        <div style={{ display: 'flex', width: 120, height: 4, background: d.rule ?? d.accent, margin: '14px 0 18px' }} />
        <div style={{ display: 'flex', fontSize: 46, color: d.accent }}>{[d.date, d.time].filter(Boolean).join('   ·   ') || 'Date & time to be announced'}</div>
        <div style={{ display: 'flex', fontSize: 38, color: '#fff', marginTop: 16 }}>{d.street}</div>
        <div style={{ display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.7)', marginTop: 6, letterSpacing: 3, textTransform: 'uppercase' }}>{d.cityState}  ·  {d.price}</div>
      </div>
      {disclaimerLine(d, w, h - bar - 34)}
      <div style={flex({ position: 'absolute', left: 0, top: h - bar })}>{agentBar(d, w, bar, d.accent)}</div>
      {watermark(d, w, h - bar)}
    </div>
  )
}

export function renderKit(kind: KitKind, d: KitData): ReactElement {
  switch (kind) {
    case 'ig-story': return story(d)
    case 'fb-post': return fbPost(d)
    case 'ig-story-2': return story2(d)
    case 'ig-feature': return igFeature(d)
    case 'ig-collage': return igCollage(d)
    case 'open-house': return openHouse(d)
    case 'price-reduced':
    case 'ig-square':
    default: return photoHero(d, kind)
  }
}
