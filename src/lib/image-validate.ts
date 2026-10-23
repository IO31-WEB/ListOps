/**
 * Server-side image validation by MAGIC BYTES (never trust the client's Content-Type
 * or file extension). SVG and GIF are intentionally NOT accepted for listing photos:
 * SVG can carry script and is a stored-XSS vector when served from your bucket domain.
 */

export type SniffedImage = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' }

export function sniffImage(buf: Uint8Array): SniffedImage | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return { mime: 'image/png', ext: 'png' }
  // WEBP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return { mime: 'image/webp', ext: 'webp' }
  return null
}

/** Largest side Claude Vision accepts is 8000 px; also bound total pixels to stop decompression-bomb style files. */
export const MAX_IMAGE_SIDE = 8000
export const MAX_IMAGE_PIXELS = 50_000_000

/** Read width/height from the file header only (no decoding). Returns null if it can't be determined. */
export function imageDimensions(b: Uint8Array): { width: number; height: number } | null {
  const kind = sniffImage(b)
  if (!kind) return null
  if (kind.ext === 'png') {
    if (b.length < 24) return null
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength)
    return { width: v.getUint32(16), height: v.getUint32(20) }
  }
  if (kind.ext === 'jpg') {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue }
      const marker = b[i + 1]
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue }
      const len = (b[i + 2] << 8) | b[i + 3]
      // SOF0..SOF15 except DHT(C4), JPG(C8), DAC(CC)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] }
      }
      if (len < 2) return null
      i += 2 + len
    }
    return null
  }
  // webp
  if (b.length < 30) return null
  const tag = String.fromCharCode(b[12], b[13], b[14], b[15])
  if (tag === 'VP8 ') return { width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff }
  if (tag === 'VP8L') {
    return {
      width: 1 + (((b[22] & 0x3f) << 8) | b[21]),
      height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)),
    }
  }
  if (tag === 'VP8X') {
    return { width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) }
  }
  return null
}

/** true if the image is a sane size for storage + Claude Vision. Unknown dimensions are rejected. */
export function dimensionsOk(b: Uint8Array): boolean {
  const d = imageDimensions(b)
  if (!d || d.width < 1 || d.height < 1) return false
  return d.width <= MAX_IMAGE_SIDE && d.height <= MAX_IMAGE_SIDE && d.width * d.height <= MAX_IMAGE_PIXELS
}
