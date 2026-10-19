/**
 * POST /api/contact — public contact form (no login required).
 * Protections: strict zod validation, honeypot field, per-IP rate limit (fails closed),
 * header-injection stripping, 8 KB body cap.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ApiError, handleApiError, readJson } from '@/lib/api-utils'
import { rateLimitContact, rateLimitHeaders } from '@/lib/ratelimit'
import { sendEmail, SUPPORT_EMAIL, oneLine } from '@/lib/email'
import { cleanText } from '@/lib/listing-schemas'

const Schema = z.object({
  name: z.string().transform(s => oneLine(s, 100)).pipe(z.string().min(1)),
  email: z.string().trim().toLowerCase().email().max(200),
  company: z.string().transform(s => oneLine(s, 120)).optional(),
  type: z.enum(['general', 'support', 'sales', 'enterprise', 'partnership', 'billing']).default('general'),
  message: z.string().transform(cleanText).pipe(z.string().min(5).max(5000)),
  website: z.string().max(200).optional(), // honeypot — real users never fill this in
})

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimitContact(clientIp(request))
    if (!rl.success) throw new ApiError(429, 'Too many messages. Please try again later.', rateLimitHeaders(rl))

    const data = Schema.parse(await readJson(request, 8 * 1024))

    // Honeypot tripped: pretend success so bots learn nothing.
    if (data.website) return NextResponse.json({ ok: true })

    const result = await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[Contact:${data.type}] ${data.name}`,
      replyTo: data.email,
      fromName: 'ListOps Contact Form',
      text: `From: ${data.name} <${data.email}>\nCompany: ${data.company ?? '-'}\nType: ${data.type}\n\n${data.message}`,
      tags: [{ name: 'kind', value: 'contact_form' }],
    })
    if (!result.ok) throw new ApiError(503, `We couldn't send your message right now. Please email ${SUPPORT_EMAIL} directly.`)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err, { route: 'contact' })
  }
}
