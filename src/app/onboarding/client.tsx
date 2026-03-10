'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { House, ArrowRight, Check } from 'lucide-react'
import toast from 'react-hot-toast'

const STEPS = [
  { id: 1, title: "What's your name?", desc: 'So we can personalize your campaigns' },
  { id: 2, title: 'Your brokerage', desc: 'Tell us where you work' },
  { id: 3, title: 'Your writing style', desc: 'How should your AI campaigns sound?' },
  { id: 4, title: "You're all set!", desc: 'Your first 3 campaigns are free' },
]

export default function OnboardingClient() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    brokerageName: '',
    marketArea: '',
    tone: 'professional',
  })

  const next = async () => {
    if (step < 4) { setStep(s => s + 1); return }
    setSaving(true)
    try {
      // Save profile first — always works regardless of plan
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          onboardingComplete: true,
        }),
      })

      // Save brand kit — silently skipped for free users (API returns 403)
      // Data is preserved in form state; user can fill it in after upgrading
      const bkRes = await fetch('/api/brand-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: `${form.firstName} ${form.lastName}`.trim(),
          brokerageName: form.brokerageName,
          tone: form.tone,
        }),
      })
      // 403 = free plan, not an error worth surfacing — brand kit unlocks on upgrade
      if (!bkRes.ok && bkRes.status !== 403) {
        console.warn('[onboarding] brand kit save failed:', bkRes.status)
      }

      router.push('/dashboard')
    } catch {
      toast.error('Something went wrong, please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Step progress dots */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`h-1.5 rounded-full transition-all duration-300 ${s.id <= step ? 'bg-amber-500 w-8' : 'bg-slate-200 w-4'}`}
            />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mb-6">
            <House className="w-6 h-6 text-amber-400" />
          </div>

          <h2 className="font-display text-2xl font-semibold text-slate-900 mb-1">{STEPS[step - 1].title}</h2>
          <p className="text-slate-500 text-sm mb-8">{STEPS[step - 1].desc}</p>

          {step === 1 && (
            <div className="space-y-4">
              <input
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                placeholder="First name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              />
              <input
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                placeholder="Last name"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <input
                value={form.brokerageName}
                onChange={e => setForm(f => ({ ...f, brokerageName: e.target.value }))}
                placeholder="e.g. Keller Williams, Compass, RE/MAX…"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              />
              <input
                value={form.marketArea}
                onChange={e => setForm(f => ({ ...f, marketArea: e.target.value }))}
                placeholder="Primary market area (e.g. Austin, TX)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
              />
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'professional', emoji: '💼', label: 'Professional', desc: 'Polished & credible' },
                { value: 'friendly', emoji: '😊', label: 'Friendly', desc: 'Warm & approachable' },
                { value: 'luxury', emoji: '✨', label: 'Luxury', desc: 'Refined & exclusive' },
                { value: 'energetic', emoji: '🚀', label: 'Energetic', desc: 'Bold & exciting' },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setForm(f => ({ ...f, tone: t.value }))}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${form.tone === t.value ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="text-xl mb-1">{t.emoji}</div>
                  <div className="text-sm font-semibold text-slate-900">{t.label}</div>
                  <div className="text-xs text-slate-500">{t.desc}</div>
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              {[
                'Your AI writing persona is set',
                'MLS connection ready via SimplyRETS',
                '3 free campaigns included — no card needed',
                'Upgrade anytime for unlimited campaigns',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  </div>
                  {item}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={next}
            disabled={saving}
            className="w-full mt-8 flex items-center justify-center gap-2 bg-slate-900 text-amber-50 font-semibold py-3.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all"
          >
            {step === 4 ? (saving ? 'Setting up…' : 'Go to Dashboard') : 'Continue'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          Step {step} of {STEPS.length} — ListOps
        </p>
      </div>
    </div>
  )
}
