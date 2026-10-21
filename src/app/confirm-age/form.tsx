'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'

export default function ConfirmAgeForm() {
  const router = useRouter()
  const [choice, setChoice] = useState<'adult' | 'minor' | null>(null)
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = !busy && (choice === 'minor' || (choice === 'adult' && accept))

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/user/confirm-age', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adult: choice === 'adult', acceptTerms: accept }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
      if (data.blocked) { window.location.href = '/age-blocked'; return }
      router.push('/onboarding')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  const opt = (active: boolean) =>
    `flex items-center gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${active ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`

  return (
    <main className="min-h-screen bg-[var(--cream)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-amber-100/80 p-8">
        <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center mb-4"><ShieldCheck className="w-6 h-6 text-amber-600" /></div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Confirm your age to continue</h1>
        <p className="text-sm text-slate-500 mt-2">ListOps is only available to people 18 and older. This takes five seconds and is required once.</p>

        <fieldset className="mt-6 space-y-3">
          <legend className="sr-only">Your age</legend>
          <label className={opt(choice === 'adult')}>
            <input type="radio" name="age" className="h-5 w-5 accent-amber-500" checked={choice === 'adult'} onChange={() => setChoice('adult')} />
            <span className="text-sm font-semibold text-slate-900">I am 18 years of age or older</span>
          </label>
          <label className={opt(choice === 'minor')}>
            <input type="radio" name="age" className="h-5 w-5 accent-amber-500" checked={choice === 'minor'} onChange={() => setChoice('minor')} />
            <span className="text-sm font-semibold text-slate-900">I am under 18</span>
          </label>
        </fieldset>

        {choice === 'adult' && (
          <label className="mt-5 flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-amber-500" checked={accept} onChange={e => setAccept(e.target.checked)} />
            <span className="text-sm text-slate-700">
              I have read and agree to the <Link href="/terms" target="_blank" className="underline text-amber-700">Terms of Service</Link> and{' '}
              <Link href="/privacy" target="_blank" className="underline text-amber-700">Privacy Policy</Link>.
            </span>
          </label>
        )}
        {choice === 'minor' && (
          <p className="mt-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            You must be 18 or older to use ListOps. If you continue, your account will be closed.
          </p>
        )}
        {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}

        <button onClick={submit} disabled={!canSubmit}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-3.5 rounded-xl transition-colors">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {choice === 'minor' ? 'Close my account' : 'Continue'}
        </button>
      </div>
    </main>
  )
}
