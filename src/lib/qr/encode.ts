/**
 * Minimal, dependency-free QR Code generator (ISO/IEC 18004): byte mode, error-correction level M, versions 1–10
 * (up to 213 bytes). Pure functions only, so it is unit-testable and safe in server components.
 */

// Per version (index = version): [ecCodewordsPerBlock, group1Blocks, group1DataCw, group2Blocks, group2DataCw]
const M_TABLE: Array<[number, number, number, number, number] | null> = [
  null,
  [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44],
]
const ALIGN: number[][] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]]
export const MAX_VERSION = 10

const dataCapacity = (v: number) => { const t = M_TABLE[v]!; return t[1] * t[2] + t[3] * t[4] }
/** Max bytes that fit at level M in a given version (mode + count + terminator overhead removed). */
export const byteCapacity = (v: number) => dataCapacity(v) - (v < 10 ? 2 : 3)

// ── GF(256) / Reed–Solomon ──────────────────────────────────────
const EXP = new Uint8Array(512), LOG = new Uint8Array(256)
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] }
const gmul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

function rsGenerator(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) { next[j] ^= poly[j]; next[j + 1] ^= gmul(poly[j], EXP[i]) }
    poly = next
  }
  return poly // leading coefficient 1 first
}
function rsRemainder(data: number[], degree: number): number[] {
  const gen = rsGenerator(degree)
  const rem = new Array(degree).fill(0)
  for (const b of data) {
    const factor = b ^ rem.shift()!
    rem.push(0)
    for (let i = 0; i < degree; i++) rem[i] ^= gmul(gen[i + 1], factor)
  }
  return rem
}

// ── Bit stream ──────────────────────────────────────────────────
function buildCodewords(bytes: number[], version: number): number[] {
  const bits: number[] = []
  const push = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1) }
  push(0b0100, 4)
  push(bytes.length, version < 10 ? 8 : 16)
  for (const b of bytes) push(b, 8)
  const capBits = dataCapacity(version) * 8
  push(0, Math.min(4, capBits - bits.length))
  while (bits.length % 8) bits.push(0)
  const out: number[] = []
  for (let i = 0; i < bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8).join(''), 2))
  for (let pad = 0xec; out.length < dataCapacity(version); pad ^= 0xec ^ 0x11) out.push(pad)

  // Split into blocks, add EC, interleave.
  const [ecLen, g1n, g1len, g2n, g2len] = M_TABLE[version]!
  const blocks: number[][] = []
  let pos = 0
  for (let i = 0; i < g1n + g2n; i++) { const len = i < g1n ? g1len : g2len; blocks.push(out.slice(pos, pos + len)); pos += len }
  const ecs = blocks.map(b => rsRemainder(b, ecLen))
  const result: number[] = []
  const maxLen = Math.max(g1len, g2len)
  for (let i = 0; i < maxLen; i++) for (const b of blocks) if (i < b.length) result.push(b[i])
  for (let i = 0; i < ecLen; i++) for (const e of ecs) result.push(e[i])
  return result
}

// ── Matrix ──────────────────────────────────────────────────────
export interface QrMatrix { version: number; size: number; modules: boolean[][] }

const bit = (v: number, i: number) => ((v >>> i) & 1) !== 0

function drawFunctionPatterns(version: number, size: number, mod: boolean[][], fn: boolean[][]) {
  const set = (x: number, y: number, dark: boolean) => { if (x >= 0 && x < size && y >= 0 && y < size) { mod[y][x] = dark; fn[y][x] = true } }
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0) }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4) }
  const pos = ALIGN[version], last = pos.length - 1
  for (let i = 0; i < pos.length; i++) for (let j = 0; j < pos.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }
  drawFormat(0, size, mod, fn) // reserve; redrawn with the real mask later
  if (version >= 7) {
    let rem = version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (version << 12) | rem
    for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), b = Math.floor(i / 3); set(a, b, bit(bits, i)); set(b, a, bit(bits, i)) }
  }
}

function drawFormat(mask: number, size: number, mod: boolean[][], fn: boolean[][]) {
  const set = (x: number, y: number, dark: boolean) => { mod[y][x] = dark; fn[y][x] = true }
  const data = (0 << 3) | mask // level M = 00
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  const bits = ((data << 10) | rem) ^ 0x5412
  for (let i = 0; i <= 5; i++) set(8, i, bit(bits, i))
  set(8, 7, bit(bits, 6)); set(8, 8, bit(bits, 7)); set(7, 8, bit(bits, 8))
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(bits, i))
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(bits, i))
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(bits, i))
  set(8, size - 8, true) // always-dark module
}

function placeData(codewords: number[], size: number, mod: boolean[][], fn: boolean[][]) {
  let i = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j
      const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert
      if (!fn[y][x] && i < codewords.length * 8) { mod[y][x] = bit(codewords[i >>> 3], 7 - (i & 7)); i++ }
    }
  }
}

const MASKS: Array<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0, (_x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

function penalty(m: boolean[][], size: number): number {
  let p = 0
  const lines = (get: (a: number, b: number) => boolean) => {
    for (let a = 0; a < size; a++) {
      let run = 1
      for (let b = 1; b < size; b++) {
        if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p += 1 } else run = 1
      }
      const s = Array.from({ length: size }, (_, b) => (get(a, b) ? 1 : 0)).join('')
      for (const pat of ['10111010000', '00001011101']) { let k = s.indexOf(pat); while (k !== -1) { p += 40; k = s.indexOf(pat, k + 1) } }
    }
  }
  lines((y, x) => m[y][x]); lines((x, y) => m[y][x])
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3 }
  let dark = 0
  for (const row of m) for (const c of row) if (c) dark++
  p += Math.max(0, Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1) * 10
  return p
}

/** Encode UTF-8 text. Throws RangeError if it does not fit in version 10 at level M. */
export function encodeQr(text: string): QrMatrix {
  const bytes = Array.from(new TextEncoder().encode(text))
  let version = 1
  while (version <= MAX_VERSION && bytes.length > byteCapacity(version)) version++
  if (version > MAX_VERSION) throw new RangeError('QR text too long')
  const size = version * 4 + 17
  const codewords = buildCodewords(bytes, version)

  const base = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  drawFunctionPatterns(version, size, base, fn)
  placeData(codewords, size, base, fn)

  let best: boolean[][] | null = null, bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    const m = base.map(r => r.slice())
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x]
    drawFormat(mask, size, m, fn.map(r => r.slice()))
    const score = penalty(m, size)
    if (score < bestScore) { bestScore = score; best = m }
  }
  return { version, size, modules: best! }
}

/** SVG path data (one `M x y h w v1 h-w z` per horizontal run of dark modules), in module units with a `quiet`-module border. */
export function qrPath(q: QrMatrix, quiet = 4): string {
  const parts: string[] = []
  for (let y = 0; y < q.size; y++) {
    let x = 0
    while (x < q.size) {
      if (!q.modules[y][x]) { x++; continue }
      let w = 1
      while (x + w < q.size && q.modules[y][x + w]) w++
      parts.push(`M${x + quiet} ${y + quiet}h${w}v1h-${w}z`)
      x += w
    }
  }
  return parts.join('')
}

/** Standalone print-ready SVG (white background, black modules, 4-module quiet zone as the spec requires). */
export function qrSvg(text: string, opts: { quiet?: number; dark?: string; light?: string } = {}): string {
  const quiet = opts.quiet ?? 4
  const q = encodeQr(text)
  const dim = q.size + quiet * 2
  const dark = /^#[0-9a-fA-F]{6}$/.test(opts.dark ?? '') ? opts.dark! : '#000000'
  const light = /^#[0-9a-fA-F]{6}$/.test(opts.light ?? '') ? opts.light! : '#ffffff'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim * 8}" height="${dim * 8}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="${light}"/><path d="${qrPath(q, quiet)}" fill="${dark}"/></svg>`
}
