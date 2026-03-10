'use client'

import { useState } from 'react'
import Link from 'next/link'
import { House, ArrowRight, Mail, Send } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', type: 'general', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const defaultType = searchParams?.get('type') || 'general'

  const submit = async () => {
    if (!form.name || !form.email || !form.message) { toast.error('Please fill in all required fields'); return }
    setSending(true)
    setTimeout(() => {
      setSent(true)
      setSending(false)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-amber-100/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <House className="w-4 h-4 text-amber-400" />
            </div>
            <span className="font-display font-semibold text-slate-900 text-lg">ListOps</span>
          </Link>
          <Link href="/sign-in" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Sign In</Link>
        </div>
      </nav>

      <div className="pt-28 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="font-display text-4xl sm:text-5xl font-semibold text-slate-900 mb-4">Get in Touch</h1>
            <p className="text-slate-600">Enterprise inquiries, partnership opportunities, or just a question — we'd love to hear from you.</p>
          </div>

          {sent ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <Send className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-slate-900 mb-2">Message sent!</h2>
              <p className="text-slate-500 mb-6">We typically respond within 1 business day.</p>
              <Link href="/" className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-slate-800 transition-colors">
                Back to Home <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sarah Mitchell" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Work Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="sarah@brokerage.com" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Company / Brokerage</label>
                <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Keller Williams Realty" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Inquiry Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                  <option value="general">General Question</option>
                  <option value="enterprise">Enterprise / MLS Partnership</option>
                  <option value="brokerage">Brokerage Plan</option>
                  <option value="support">Technical Support</option>
                  <option value="billing">Billing</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Message *</label>
                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={5} placeholder="Tell us what you're looking for…" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none" />
              </div>
              <button onClick={submit} disabled={sending} className="w-full flex items-center justify-center gap-2 bg-slate-900 text-amber-50 font-semibold py-3.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all">
                <Mail className="w-4 h-4" />
                {sending ? 'Sending…' : 'Send Message'}
              </button>
            </div>
          )}

          <div className="text-center mt-8 text-sm text-slate-500">
            Or email us directly at{' '}
            <a href="mailto:hello@listops.io" className="text-amber-600 hover:underline font-medium">hello@listops.io</a>
          </div>
        </div>
      </div>
    </div>
  )
}
