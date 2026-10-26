import { randomBytes } from 'crypto'

export const QR_PLACEMENTS = ['flyer', 'yard_sign', 'open_house', 'brochure', 'postcard'] as const
export type QrPlacement = (typeof QR_PLACEMENTS)[number]
export const PLACEMENT_LABEL: Record<QrPlacement, string> = { flyer: 'Flyer', yard_sign: 'Yard sign', open_house: 'Open house sign-in', brochure: 'Brochure', postcard: 'Postcard' }

// 31 symbols, no 0/1/o/i/l: 8 chars ≈ 39 bits — unguessable enough for a public counter, short enough for a small QR.
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export const CODE_RE = /^[2-9a-hjkmnp-z]{8}$/

export function newQrCode(): string {
  const bytes = randomBytes(8)
  let out = ''
  for (let i = 0; i < 8; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'https://listops.io').replace(/\/+$/, '')
export const qrTargetUrl = (code: string) => `${appUrl()}/q/${code}`

/** Where a scan lands. Only ever the campaign's own microsite (fixed path), so the redirect can't be abused as an open redirect. */
export const micrositeLanding = (slug: string, placement: string) =>
  `/l/${encodeURIComponent(slug)}?utm_source=qr&utm_medium=print&utm_campaign=${encodeURIComponent(placement)}`
