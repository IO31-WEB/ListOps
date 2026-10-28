'use client'

/**
 * Account — Clerk's profile / security UI embedded in the dashboard (not a floating modal), themed with the app's
 * own palette (lib/clerk-appearance.ts). Reached from the avatar menu and Settings → Account & Security.
 */
import Link from 'next/link'
import { UserProfile } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import { clerkEmbeddedProfile } from '@/lib/clerk-appearance'

export default function AccountPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-3 transition-colors">
          <ArrowLeft className="w-4 h-4" />Back to Settings
        </Link>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Account</h1>
        <p className="text-sm text-slate-500 mt-1">Your profile, email, password, two-factor sign-in and active sessions.</p>
      </div>
      <UserProfile routing="hash" appearance={clerkEmbeddedProfile} />
    </div>
  )
}
