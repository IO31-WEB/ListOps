/**
 * Admin access control.
 *
 * Access is granted ONLY when ALL of these hold, checked on the SERVER for every admin page and API call:
 *   1. the request has a valid Clerk session,
 *   2. the user's PRIMARY email address is VERIFIED by Clerk (an unverified address proves nothing), and
 *   3. that address is in ADMIN_EMAILS below.
 *
 * Hard-coded on purpose (for now): changing who is an admin requires a code review + deploy, and there is no
 * database flag or env var an attacker could flip. To add an admin later, add the address here.
 *
 * Non-admins get a plain 404 (not 401/403) so the existence of /admin isn't advertised.
 * IMPORTANT (Next.js): layouts do NOT re-run on client-side navigation, so EVERY admin page and API route must
 * call requireAdminPage()/requireAdminApi() itself — never rely on the layout alone.
 */
import { currentUser } from '@clerk/nextjs/server'
import { notFound } from 'next/navigation'
import { ApiError } from '@/lib/api-utils'

export const ADMIN_EMAILS: readonly string[] = ['isaiaholiver95@yahoo.com']

export interface AdminIdentity {
  clerkId: string
  email: string
}

export async function getAdmin(): Promise<AdminIdentity | null> {
  const user = await currentUser()
  if (!user) return null
  const primary = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)
  if (!primary || primary.verification?.status !== 'verified') return null
  const email = primary.emailAddress.trim().toLowerCase()
  return ADMIN_EMAILS.includes(email) ? { clerkId: user.id, email } : null
}

/** For server components / pages. Renders the 404 page for anyone who isn't an admin. */
export async function requireAdminPage(): Promise<AdminIdentity> {
  const admin = await getAdmin()
  if (!admin) notFound()
  return admin
}

/** For route handlers. Throws a 404 ApiError for anyone who isn't an admin. */
export async function requireAdminApi(): Promise<AdminIdentity> {
  const admin = await getAdmin()
  if (!admin) throw new ApiError(404, 'Not found')
  return admin
}

/**
 * CSRF defence for admin mutations: browsers always send Origin on cross-site POSTs, so require it to match
 * this site. (Cookies are SameSite=Lax by default too, this is a second layer.)
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!origin || !host) throw new ApiError(403, 'Forbidden')
  let originHost: string
  try {
    originHost = new URL(origin).host
  } catch {
    throw new ApiError(403, 'Forbidden')
  }
  if (originHost !== host) throw new ApiError(403, 'Forbidden')
}
