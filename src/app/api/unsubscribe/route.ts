/**
 * One-click unsubscribe endpoint referenced by the List-Unsubscribe header (RFC 8058).
 * Gmail / Apple Mail / Outlook POST here when the user clicks their client's "Unsubscribe" button.
 * Public by design; authenticity is proven by the HMAC token in the URL.
 */
import { NextRequest, NextResponse } from 'next/server'
import { decodeEmailParam, verifyEmailToken } from '@/lib/unsubscribe'
import { suppressEmail } from '@/lib/email'
import { captureError } from '@/lib/monitoring'

async function handle(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = decodeEmailParam(searchParams.get('e') ?? '')
  const token = searchParams.get('t') ?? ''
  if (!email || !verifyEmailToken(email, token)) {
    return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 400 })
  }
  try {
    await suppressEmail(email, 'unsubscribe')
    return NextResponse.json({ ok: true })
  } catch (err) {
    captureError(err, { route: 'unsubscribe' })
    return NextResponse.json({ error: 'Could not process your request. Please email support.' }, { status: 500 })
  }
}

export const POST = handle
export const GET = handle
