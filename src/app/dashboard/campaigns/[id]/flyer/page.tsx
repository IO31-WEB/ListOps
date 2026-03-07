import { redirect } from 'next/navigation'

// Redirect all flyer requests to the standalone /flyer/[id] route
// which has no dashboard layout wrapper — clean print output
export default async function FlyerRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/flyer/${id}`)
}
