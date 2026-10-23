import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Age / terms gate (server-enforced). Selects 2 columns only, so it is a ~1ms indexed lookup.
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
    columns: { ageConfirmedAt: true, ageBlockedAt: true, deletedAt: true },
  })
  if (user?.deletedAt) redirect('/account-closed')
  if (user?.ageBlockedAt) redirect('/age-blocked')
  if (!user?.ageConfirmedAt) redirect('/confirm-age')

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
