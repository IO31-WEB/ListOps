import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import ConfirmAgeForm from './form'

export const metadata = { title: 'Confirm your age', robots: { index: false } }

export default async function ConfirmAgePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
    columns: { ageConfirmedAt: true, ageBlockedAt: true, onboardingComplete: true },
  })
  if (user?.ageBlockedAt) redirect('/age-blocked')
  if (user?.ageConfirmedAt) redirect(user.onboardingComplete ? '/dashboard' : '/onboarding')

  return <ConfirmAgeForm />
}
