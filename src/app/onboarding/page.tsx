import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import OnboardingClient from './client'

export default async function OnboardingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Check if onboarding already complete
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
  if (user?.ageBlockedAt) redirect('/age-blocked')
  if (!user?.ageConfirmedAt) redirect('/confirm-age') // age + terms must be confirmed first
  if (user?.onboardingComplete) redirect('/dashboard')

  return <OnboardingClient />
}
