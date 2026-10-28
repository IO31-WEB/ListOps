/**
 * Resolve the signed-in Clerk user to our DB row, creating it if the Clerk webhook has not landed yet (sign-up race),
 * plus the user's VERIFIED primary email (null if unverified). Used by the invite and referral landing pages.
 */
import { currentUser } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { getOrCreateUser } from '@/lib/user-service'

export async function ensureDbUser() {
  const cu = await currentUser()
  if (!cu) return null
  const primary = cu.emailAddresses.find(e => e.id === cu.primaryEmailAddressId) ?? cu.emailAddresses[0]
  if (!primary) return null
  const verifiedEmail = primary.verification?.status === 'verified' ? primary.emailAddress : null

  let user = await db.query.users.findFirst({ where: eq(users.clerkId, cu.id) })
  if (!user) {
    await getOrCreateUser(cu.id, { email: primary.emailAddress, firstName: cu.firstName ?? undefined, lastName: cu.lastName ?? undefined, avatarUrl: cu.imageUrl })
    user = await db.query.users.findFirst({ where: eq(users.clerkId, cu.id) })
  }
  return user ? { user, clerkId: cu.id, verifiedEmail } : null
}
