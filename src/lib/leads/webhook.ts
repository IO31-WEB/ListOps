/**
 * Outbound lead webhook (Zapier "Catch Hook", Make, n8n, or the agent's own CRM).
 * SSRF-hardened: https only, no credentials/odd ports, no private/loopback/link-local targets (checked on the literal
 * host AND on every resolved address at send time), redirects are NOT followed, 5 s timeout.
 */
import { createHmac } from 'node:crypto'
import { lookup } from 'node:dns/promises'

export function isPrivateIPv4(ip: string): boolean {
  const p = ip.split('.').map(Number)
  if (p.length !== 4 || p.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true // malformed -> treat as unsafe
  const [a, b] = p
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19))
  )
}

export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (v.includes(':')) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v)
    if (mapped) return isPrivateIPv4(mapped[1])
    return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff')
  }
  return isPrivateIPv4(v)
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string }

export function validateWebhookUrl(raw: string): UrlCheck {
  if (!raw || raw.length > 500) return { ok: false, reason: 'URL is empty or too long.' }
  let u: URL
  try { u = new URL(raw.trim()) } catch { return { ok: false, reason: 'Enter a valid URL.' } }
  if (u.protocol !== 'https:') return { ok: false, reason: 'Webhook URL must start with https://' }
  if (u.username || u.password) return { ok: false, reason: 'Credentials in the URL are not allowed.' }
  if (u.port && u.port !== '443') return { ok: false, reason: 'Only the default HTTPS port is allowed.' }
  const host = u.hostname.toLowerCase()
  if (!host.includes('.') && !host.includes(':')) return { ok: false, reason: 'Host must be a public domain name.' }
  if (host === 'localhost' || /\.(local|localhost|internal|lan|home|corp)$/.test(host)) return { ok: false, reason: 'Host must be a public domain name.' }
  if (host.startsWith('[') || host.includes(':')) return { ok: false, reason: 'IPv6 addresses are not allowed. Use a domain name.' }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isPrivateIPv4(host)) return { ok: false, reason: 'Private network addresses are not allowed.' }
  return { ok: true, url: u }
}

export function signPayload(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export interface LeadWebhookPayload {
  event: 'lead.created' | 'lead.test'
  id: string
  createdAt: string
  type: 'showing' | 'info'
  name: string
  email: string
  phone: string | null
  message: string | null
  preferredDate: string | null
  preferredTime: string | null
  consent: { given: boolean; text: string; at: string }
  source: { source: string | null; medium: string | null; campaign: string | null; referrerHost: string | null }
  property: { address: string; price: number | null; micrositeUrl: string | null }
  campaignId: string | null
}

export type DeliverResult = { ok: true; status: number } | { ok: false; reason: string; status?: number }

export async function deliverWebhook(args: { url: string; secret: string; payload: LeadWebhookPayload }): Promise<DeliverResult> {
  const check = validateWebhookUrl(args.url)
  if (!check.ok) return { ok: false, reason: check.reason }
  try {
    const addrs = await lookup(check.url.hostname, { all: true })
    if (addrs.length === 0 || addrs.some(a => isPrivateIp(a.address))) return { ok: false, reason: 'Host resolves to a private address.' }
  } catch {
    return { ok: false, reason: 'Host could not be resolved.' }
  }
  const body = JSON.stringify(args.payload)
  const ts = String(Math.floor(Date.now() / 1000))
  try {
    const res = await fetch(check.url, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ListOps-Webhook/1.0',
        'X-ListOps-Event': args.payload.event,
        'X-ListOps-Timestamp': ts,
        'X-ListOps-Signature': `sha256=${signPayload(args.secret, ts, body)}`,
      },
      body,
    })
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status }
    return { ok: false, reason: `Endpoint answered HTTP ${res.status}.`, status: res.status }
  } catch {
    return { ok: false, reason: 'Request failed or timed out.' }
  }
}
