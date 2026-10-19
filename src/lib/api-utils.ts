/**
 * Shared API helpers.
 *
 * Rules enforced here:
 *  - Clients only ever see a short, generic message + a request id.
 *  - Stack traces, SQL errors, upstream API bodies and key names are logged
 *    server-side (and sent to Sentry) but NEVER returned in a response.
 */

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { captureError } from '@/lib/monitoring'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public headers?: Record<string, string>
  ) {
    super(message)
  }
}

function newRequestId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function jsonError(status: number, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers })
}

/** Returns the Clerk userId or throws a 401. Use at the top of every route. */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new ApiError(401, 'Unauthorized')
  return userId
}

/**
 * Convert any thrown value into a safe response.
 * - ApiError      -> its own (deliberately user-safe) message
 * - ZodError      -> 400 with field names only (no echoing of submitted values)
 * - anything else -> 500 "Something went wrong" + request id; details to Sentry/logs
 */
export function handleApiError(err: unknown, context: Record<string, unknown> = {}) {
  if (err instanceof ApiError) {
    return jsonError(err.status, err.message, err.headers)
  }
  if (err instanceof z.ZodError) {
    const fields = Array.from(new Set(err.issues.map(i => i.path.join('.') || 'body')))
    return jsonError(400, `Invalid input: ${fields.join(', ')}`)
  }
  const requestId = newRequestId()
  captureError(err, { ...context, requestId })
  console.error(`[api] unhandled error requestId=${requestId}`, err)
  return NextResponse.json(
    { error: 'Something went wrong on our side. Please try again.', requestId },
    { status: 500 }
  )
}

/** Parse JSON body with a hard size cap so nobody can POST 50MB of JSON at us. */
export async function readJson(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const len = Number(request.headers.get('content-length') ?? 0)
  if (len > maxBytes) throw new ApiError(413, 'Request too large')
  const text = await request.text()
  if (text.length > maxBytes) throw new ApiError(413, 'Request too large')
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(400, 'Invalid JSON')
  }
}
