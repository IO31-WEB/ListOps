'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2, Check, User, Bell, Lock, Globe, Shield, Zap, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

interface ProfileForm {
  firstName: string; lastName: string; phone: string
  licenseNumber: string; mlsAgentId: string; timezone: string
}

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
]

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileForm>({
    firstName: '', lastName: '', phone: '', licenseNumber: '', mlsAgentId: '', timezone: 'America/New_York',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [referralUrl, setReferralUrl] = useState<string>('')

  const set = (key: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setProfile(prev => ({ ...prev, [key]: e.target.value }))

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const [profileRes, referralRes] = await Promise.all([
          fetch('/api/user/profile'),
          fetch('/api/referral'),
        ])
        if (profileRes.ok) {
          const data = await profileRes.json()
          setProfile(prev => ({
            ...prev,
            firstName: data.user?.firstName ?? '',
            lastName: data.user?.lastName ?? '',
            phone: data.user?.phone ?? '',
            licenseNumber: data.user?.licenseNumber ?? '',
            mlsAgentId: data.user?.mlsAgentId ?? '',
            timezone: data.user?.timezone ?? 'America/New_York',
          }))
        }
        if (referralRes.ok) {
          const data = await referralRes.json()
          setReferralUrl(data.referralUrl ?? '')
        }
      } catch { } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      if (!res.ok) throw new Error('Failed to save')
      setSaved(true)
      toast.success('Profile saved!')
      setTimeout(() => setSaved(false), 3000)
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-4 h-4 text-amber-600" />
          <h2 className="font-display font-semibold text-slate-900">Profile</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { label: 'First Name', key: 'firstName' as const, placeholder: 'Sarah' },
            { label: 'Last Name', key: 'lastName' as const, placeholder: 'Mitchell' },
            { label: 'Phone', key: 'phone' as const, placeholder: '(512) 555-0100', type: 'tel' },
            { label: 'License Number', key: 'licenseNumber' as const, placeholder: 'TX-12345678' },
            { label: 'MLS Agent ID', key: 'mlsAgentId' as const, placeholder: 'Optional' },
          ].map(field => (
            <div key={field.key}>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">{field.label}</label>
              <input
                type={field.type ?? 'text'}
                value={profile[field.key]}
                onChange={set(field.key)}
                placeholder={field.placeholder}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Timezone</label>
            <select
              value={profile.timezone}
              onChange={set('timezone')}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            >
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 bg-slate-900 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4 text-amber-400" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Account security */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-4 h-4 text-amber-600" />
          <h2 className="font-display font-semibold text-slate-900">Account & Security</h2>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Email & Password', desc: 'Managed by Clerk — click to open security settings', href: '/user-profile' },
            { label: 'Two-Factor Authentication', desc: 'Add an extra layer of security to your account', href: '/user-profile' },
            { label: 'Active Sessions', desc: 'View and revoke active login sessions', href: '/user-profile' },
          ].map(item => (
            <a key={item.label} href={item.href} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors group">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
              <span className="text-xs text-amber-600 font-medium group-hover:underline">Manage →</span>
            </a>
          ))}
        </div>
      </div>

      {/* Referral program */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber-600" />
          <h2 className="font-display font-semibold text-slate-900">Referral Program</h2>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Refer a colleague and get <strong>1 free month</strong> when they upgrade to any paid plan.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-800 mb-2">Your Referral Link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-amber-200 rounded-lg px-3 py-2 font-mono text-slate-700 truncate">
              {referralUrl || 'Loading…'}
            </code>
            <button
              onClick={() => {
                if (!referralUrl) return
                navigator.clipboard.writeText(referralUrl)
                toast.success('Copied!')
              }}
              disabled={!referralUrl}
              className="text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white rounded-2xl border border-red-200 p-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <h2 className="font-display font-semibold text-red-900">Danger Zone</h2>
        </div>
        <p className="text-sm text-slate-600 mb-4">These actions are permanent and cannot be undone.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/billing" className="text-sm font-medium text-slate-700 border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 transition-colors">
            Cancel Subscription
          </Link>
          <button
            onClick={() => toast.error('Please contact support@listops.io to delete your account.')}
            className="text-sm font-medium text-red-600 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  )
}
