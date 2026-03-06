'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Search } from 'lucide-react'

const BREADCRUMBS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/generate': 'New Campaign',
  '/dashboard/campaigns': 'My Campaigns',
  '/dashboard/brand': 'Brand Kit',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/billing': 'Billing',
  '/dashboard/team': 'Team',
  '/dashboard/settings': 'Settings',
}

export function DashboardHeader() {
  const pathname = usePathname()
  const title = BREADCRUMBS[pathname] || 'Dashboard'

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between flex-shrink-0">
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
        <button className="hidden sm:flex items-center gap-2 bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500 text-sm px-3 py-1.5 rounded-lg">
          <Search className="w-3.5 h-3.5" />
          <span>Search...</span>
          <kbd className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
        </button>
        <button className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
        </button>
      </div>
    </header>
  )
}
