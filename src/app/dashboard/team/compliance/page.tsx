import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react'
import { getTeamAdminContext } from '@/lib/team-data'
import { ComplianceForm } from './compliance-form'

export const metadata = { title: 'Compliance Profile' }

export default async function CompliancePage() {
  const ctx = await getTeamAdminContext()
  if (!ctx) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-10 text-center">
        <Lock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <h1 className="font-display text-xl font-semibold text-slate-900">Brokerage compliance profile</h1>
        <p className="text-sm text-slate-500 mt-2">Set a required disclaimer and lock brand fields for every agent. Available to owners and admins on the Brokerage plan.</p>
        <Link href="/dashboard/billing" className="inline-block bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-xl mt-5">See plans</Link>
      </div>
    )
  }
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/team" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="w-4 h-4" /> Team</Link>
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-amber-600" /> Compliance profile</h1>
        <p className="text-sm text-slate-500 mt-1">Applied to every agent&apos;s flyers, graphics, microsites and generated copy. Agents cannot remove it.</p>
      </div>
      <ComplianceForm />
    </div>
  )
}
