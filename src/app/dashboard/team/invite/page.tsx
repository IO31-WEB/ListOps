'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Send, Check, AlertCircle, Users } from 'lucide-react'
import Link from 'next/link'

const ROLE_OPTIONS = [
  { value: 'agent', label: 'Agent', desc: 'Can create campaigns and manage their own listings' },
  { value: 'admin', label: 'Admin', desc: 'Full access except billing and owner settings' },
  { value: 'viewer', label: 'Viewer', desc: 'Can view campaigns but not create or edit' },
]

export default function InviteAgentPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('agent')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.')
      setStatus('error')
      return
    }

    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Failed to send invite. Please try again.')
        setStatus('error')
        return
      }

      setStatus('success')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-slate-900 mb-2">Invite sent!</h2>
          <p className="text-slate-500 mb-6">
            We sent an invite to <span className="font-semibold text-slate-700">{email}</span>.
            They'll receive an email with a link to join your team.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setEmail(''); setRole('agent'); setStatus('idle') }}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Invite another
            </button>
            <Link
              href="/dashboard/team"
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Back to Team
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/dashboard/team" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Team
        </Link>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Invite an Agent</h1>
        <p className="text-sm text-slate-500 mt-1">They'll receive an email invitation to join your team.</p>
      </div>

      {/* Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setStatus('idle') }}
              placeholder="agent@brokerage.com"
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Role</label>
          <div className="space-y-2">
            {ROLE_OPTIONS.map(r => (
              <label
                key={r.value}
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                  role === r.value
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={role === r.value}
                  onChange={() => setRole(r.value)}
                  className="mt-0.5 accent-slate-900"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">{r.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{r.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Error */}
        {status === 'error' && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={status === 'loading'}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-60"
        >
          {status === 'loading' ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
          ) : (
            <><Send className="w-4 h-4" />Send Invite</>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <Users className="w-4 h-4 flex-shrink-0" />
        Invites expire after 7 days. The agent will need to create a ListOps account if they don't have one.
      </div>
    </div>
  )
}
