import { timingSafeEqual } from 'crypto'

/** Cron endpoints require "Authorization: Bearer <CRON_SECRET>" (Vercel Cron sends it automatically). Fails closed. */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) return false
  const given = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected))
}
