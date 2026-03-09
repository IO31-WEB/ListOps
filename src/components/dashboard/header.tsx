'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Search, X, Zap, CheckCircle, AlertCircle } from 'lucide-react'

const BREADCRUMBS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/generate': 'New Campaign',
  '/dashboard/campaigns': 'My Campaigns',
  '/dashboard/brand': 'Brand Kit',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/billing': 'Billing',
  '/dashboard/team': 'Team',
  '/dashboard/referral': 'Refer & Earn',
  '/dashboard/settings': 'Settings',
}

const SEARCH_LINKS = [
  { label: 'New Campaign', href: '/dashboard/generate', desc: 'Generate a new 6-week campaign' },
  { label: 'My Campaigns', href: '/dashboard/campaigns', desc: 'View all your saved campaigns' },
  { label: 'Brand Kit', href: '/dashboard/brand', desc: 'Update your logo, colors, and agent info' },
  { label: 'Billing & Plans', href: '/dashboard/billing', desc: 'Upgrade or manage your subscription' },
  { label: 'Team', href: '/dashboard/team', desc: 'Invite and manage team members' },
  { label: 'Settings', href: '/dashboard/settings', desc: 'Account and notification settings' },
  { label: 'Analytics', href: '/dashboard/analytics', desc: 'View campaign performance' },
  { label: 'Help & FAQ', href: '/help', desc: 'Get answers to common questions' },
]

interface Notification {
  id: string
  type: 'success' | 'info' | 'warning'
  title: string
  body: string
  createdAt: number  // unix ms timestamp
  read: boolean
  href?: string      // click destination
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

const NOTIF_STORAGE_KEY = 'campaignai_notifications_v3'

function getWelcomeNotifications(): Notification[] {
  // Only the welcome notification — seeded once, marked read immediately
  // Real campaign notifications come from the API
  const now = Date.now()
  return [
    { id: 'welcome', type: 'info', title: 'Welcome to CampaignAI', body: 'Generate your first campaign to get started.', createdAt: now, read: false, href: '/dashboard/generate' },
  ]
}

function loadNotifications(): Notification[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem(NOTIF_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Notification[]
      // Validate it's an array with the right shape
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) return parsed
    }
  } catch {}
  return getWelcomeNotifications()
}

function saveNotifications(notifs: Notification[]) {
  try { localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(notifs)) } catch {}
}

export function DashboardHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const title = BREADCRUMBS[pathname] || 'Dashboard'

  // Search
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredLinks = SEARCH_LINKS.filter(l =>
    !searchQuery || l.label.toLowerCase().includes(searchQuery.toLowerCase()) || l.desc.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(loadNotifications)
  const [, setTick] = useState(0)

  // Re-render every 60s so timeAgo() stays current
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Persist to localStorage whenever notifications change
  useEffect(() => {
    saveNotifications(notifications)
  }, [notifications])

  // Poll for real notifications from server every 30s
  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await fetch('/api/notifications')
        if (!res.ok) return
        const data = await res.json()
        if (data.notifications?.length) {
          setNotifications(prev => {
            const existingIds = new Set(prev.map((n: Notification) => n.id))
            const newOnes = data.notifications.filter((n: Notification) => !existingIds.has(n.id))
            if (!newOnes.length) return prev
            return [...newOnes, ...prev]
          })
        }
      } catch {}
    }
    fetchNotifs()
    const interval = setInterval(fetchNotifs, 30_000)
    return () => clearInterval(interval)
  }, [])
  const unreadCount = notifications.filter(n => !n.read).length
  const notifRef = useRef<HTMLDivElement>(null)

  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })))

  // Auto-mark all read when dropdown opens
  useEffect(() => {
    if (notifOpen) {
      // Small delay so badge visually clears after dropdown is visible
      const t = setTimeout(() => markAllRead(), 800)
      return () => clearTimeout(t)
    }
  }, [notifOpen])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Cmd+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') { setSearchOpen(false); setNotifOpen(false) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50)
  }, [searchOpen])

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between flex-shrink-0 relative z-30">
      <div>
        <h1 className="font-display text-lg font-semibold text-slate-900">{title}</h1>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
          <Link href="/dashboard" className="hover:text-slate-600 transition-colors">Home</Link>
          {pathname !== '/dashboard' && (
            <>
              <span>/</span>
              <span className="text-slate-600">{title}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">

        {/* Search */}
        <div ref={searchRef} className="relative">
          <button
            onClick={() => setSearchOpen(v => !v)}
            className="hidden sm:flex items-center gap-2 bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500 text-sm px-3 py-1.5 rounded-lg"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search...</span>
            <kbd className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
          </button>

          {searchOpen && (
            <div className="absolute right-0 top-10 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search pages..."
                  className="flex-1 text-sm outline-none text-slate-900 placeholder-slate-400"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && filteredLinks.length > 0) {
                      router.push(filteredLinks[0].href)
                      setSearchOpen(false)
                      setSearchQuery('')
                    }
                  }}
                />
                {searchQuery && <button onClick={() => setSearchQuery('')}><X className="w-3.5 h-3.5 text-slate-400" /></button>}
              </div>
              <div className="py-2 max-h-72 overflow-y-auto">
                {filteredLinks.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No results for &ldquo;{searchQuery}&rdquo;</p>
                ) : filteredLinks.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                    className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{link.label}</p>
                      <p className="text-xs text-slate-500">{link.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setNotifOpen(v => !v); if (!notifOpen) markAllRead() }}
            className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-10 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <span className="font-semibold text-sm text-slate-900">Notifications</span>
                <button onClick={markAllRead} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Mark all read</button>
              </div>
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {notifications.map(n => {
                  const inner = (
                    <>
                      <div className="flex-shrink-0 mt-0.5">
                        {n.type === 'success' ? <CheckCircle className="w-4 h-4 text-green-500" /> :
                         n.type === 'warning' ? <AlertCircle className="w-4 h-4 text-amber-500" /> :
                         <Zap className="w-4 h-4 text-blue-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{n.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
                        <p className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read && <span className="w-2 h-2 bg-amber-400 rounded-full flex-shrink-0 mt-1.5" />}
                    </>
                  )
                  const baseClass = `px-4 py-3 flex gap-3 transition-colors ${!n.read ? 'bg-amber-50/40' : ''}`
                  return n.href ? (
                    <Link key={n.id} href={n.href} onClick={() => { setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x)); setNotifOpen(false) }}
                      className={`${baseClass} hover:bg-slate-50 cursor-pointer`}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={n.id} className={baseClass}>{inner}</div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
