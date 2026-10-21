'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'

const KEY = 'listops_age_gate_v1'

/**
 * Sign-up gate: Clerk's sign-up form is not rendered until the visitor explicitly confirms
 * they are 18+ and accepts the Terms/Privacy Policy. This is the first of two checkpoints —
 * the authoritative, server-enforced record is made on /confirm-age (see api/user/confirm-age),
 * which also covers OAuth sign-ups and existing accounts.
 */
export function AgeGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [ok, setOk] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    try {
      setOk(sessionStorage.getItem(KEY) === '1')
    } catch { /* storage unavailable: just show the gate */ }
    setReady(true)
  }, [])

  if (!ready) return null
  if (ok) return <>{children}</>

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-amber-100/80 p-8">
      <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
        <ShieldCheck className="w-6 h-6 text-amber-600" />
      </div>
      <h1 className="font-display text-2xl font-semibold text-slate-900">Before you create your account</h1>
      <p className="text-sm text-slate-500 mt-2">ListOps is a professional tool for adults. You must be at least 18 years old to sign up.</p>

      <label className="mt-6 flex items-start gap-3 rounded-xl border-2 border-slate-200 p-4 cursor-pointer has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50 transition-colors">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => setChecked(e.target.checked)}
          className="mt-1 h-5 w-5 accent-amber-500 flex-shrink-0"
        />
        <span className="text-sm text-slate-800 leading-relaxed">
          <strong>I am 18 years of age or older</strong>, and I agree to the{' '}
          <Link href="/terms" target="_blank" className="underline text-amber-700">Terms of Service</Link> and{' '}
          <Link href="/privacy" target="_blank" className="underline text-amber-700">Privacy Policy</Link>.
        </span>
      </label>

      <button
        type="button"
        disabled={!checked}
        onClick={() => { try { sessionStorage.setItem(KEY, '1') } catch {} setOk(true) }}
        className="mt-5 w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors"
      >
        Continue to sign up
      </button>
      {!checked && <p className="text-xs text-slate-500 text-center mt-3">You must confirm the box above to continue.</p>}
      <p className="text-xs text-slate-400 text-center mt-4">
        Under 18? You can&apos;t create a ListOps account. <Link href="/" className="underline">Back to home</Link>
      </p>
    </div>
  )
}
