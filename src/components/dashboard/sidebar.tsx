'use client'

import { LogoMark } from '@/components/ui/logo'
import { getBillingInfo } from '@/lib/billing-client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import {
  Zap, LayoutDashboard, FolderOpen, Plus, Palette,
  CreditCard, Users, BarChart2, Settings, ChevronLeft, Gift,
  ChevronRight, Menu, X, HelpCircle, Building2, Inbox, CalendarDays,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { canAccess, type PlanTier, type Feature } from '@/lib/plans'

type NavItem = { label: string; href: string; icon: LucideIcon; highlight?: boolean; feature?: Feature }

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'New Campaign', href: '/dashboard/generate', icon: Plus, highlight: true },
  { label: 'My Campaigns', href: '/dashboard/campaigns', icon: FolderOpen },
  { label: 'Leads', href: '/dashboard/leads', icon: Inbox },
  { label: 'Social Calendar', href: '/dashboard/social', icon: CalendarDays },
  { label: 'Brand Kit', href: '/dashboard/brand', icon: Palette },
  { label: 'Commercial', href: '/dashboard/commercial', icon: Building2, feature: 'commercial_campaigns' as const },
  { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart2 },
]

const BOTTOM_ITEMS = [
  { label: 'Team', href: '/dashboard/team', icon: Users },
  { label: 'Refer & Earn', href: '/dashboard/referral', icon: Gift },
  { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  { label: 'Help', href: '/help', icon: HelpCircle },
]

interface BillingInfo {
  planTier: string
  campaignsUsed: number
  campaignLimit: number | 'unlimited'
}

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [billing, setBilling] = useState<BillingInfo | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    getBillingInfo()
      .then(data => {
        if (data) setBilling({
          planTier: data.planTier ?? 'free',
          campaignsUsed: data.campaignsUsed ?? 0,
          campaignLimit: data.campaignLimit ?? 3,
        })
      })
      .catch(() => {})
  }, [pathname]) // refetch on route change so it stays fresh

  const isPaid = billing && !['free'].includes(billing.planTier)
  const isAtLimit = billing && billing.campaignLimit !== 'unlimited' &&
    billing.campaignsUsed >= (billing.campaignLimit as number)

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => {
    // The slide-out drawer is always the full, expanded menu — the desktop "collapsed" state never applies to it.
    const isCollapsed = collapsed && !mobile
    return (
    <div className={cn('flex flex-col h-full', isCollapsed ? 'items-center' : '')}>
      {/* Logo */}
      <div className={cn('flex items-center py-5 px-4 border-b border-slate-100', isCollapsed ? 'justify-center' : 'justify-between')}>
        {!isCollapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <LogoMark className="w-8 h-8 flex-shrink-0" />
            <span className="font-display font-semibold text-slate-900">ListOps</span>
          </Link>
        )}
        {isCollapsed && (
          <LogoMark className="w-8 h-8" />
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main nav */}
      <nav className={cn('flex-1 p-3 overflow-y-auto', mobile ? 'space-y-2' : 'space-y-1')}>
        {NAV_ITEMS.filter(item => !item.feature || (!!billing && canAccess(billing.planTier as PlanTier, item.feature))).map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 rounded-xl text-sm font-medium transition-all group',
                mobile ? 'py-3' : 'py-2.5',
                isCollapsed && 'justify-center px-2',
                item.highlight
                  ? 'bg-slate-900 text-amber-50 hover:bg-slate-800 shadow-sm'
                  : isActive
                    ? 'bg-amber-50 text-amber-900 border border-amber-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <item.icon className={cn('flex-shrink-0', isCollapsed ? 'w-5 h-5' : 'w-4 h-4')} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Plan banner — only show if not collapsed */}
      {!isCollapsed && billing && (
        <>
          {/* FREE: show usage + upgrade */}
          {!isPaid && (
            <div className="mx-3 mb-3 p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl text-white">
              <div className="flex items-center gap-2 mb-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-amber-400">FREE PLAN</span>
              </div>
              <p className="text-xs text-slate-300 mb-1">
                {billing.campaignsUsed}/{billing.campaignLimit} campaigns used this month.
              </p>
              {isAtLimit && (
                <p className="text-xs text-red-400 mb-2">Limit reached — upgrade to continue.</p>
              )}
              {/* Usage bar */}
              <div className="h-1 bg-slate-700 rounded-full mb-3 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', isAtLimit ? 'bg-red-400' : 'bg-amber-400')}
                  style={{ width: `${Math.min(100, (billing.campaignsUsed / (billing.campaignLimit as number)) * 100)}%` }}
                />
              </div>
              <Link href="/dashboard/billing" className="block text-center text-xs font-semibold bg-amber-400 text-slate-900 py-2 rounded-lg hover:bg-amber-300 transition-colors">
                Upgrade to Pro
              </Link>
            </div>
          )}
          {/* PAID: show compact plan badge — clickable → billing */}
          {isPaid && (
            <Link href="/dashboard/billing" className="mx-3 mb-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 hover:bg-amber-100 transition-colors group">
              <Zap className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-amber-800 capitalize">{billing.planTier} Plan</p>
                <p className="text-xs text-amber-600">
                  {billing.campaignLimit === 'unlimited' ? 'Unlimited campaigns' : `${billing.campaignsUsed}/${billing.campaignLimit} this month`}
                </p>
              </div>
              <ChevronRight className="w-3 h-3 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </Link>
          )}
        </>
      )}

      {/* Bottom nav */}
      <div className={cn('border-t border-slate-100 p-3', mobile ? 'space-y-1.5' : 'space-y-1')}>
        {BOTTOM_ITEMS.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 rounded-xl text-sm font-medium transition-all',
                mobile ? 'py-2.5' : 'py-2',
                isCollapsed && 'justify-center px-2',
                isActive ? 'bg-amber-50 text-amber-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              )}
            >
              <item.icon className={cn('flex-shrink-0', isCollapsed ? 'w-5 h-5' : 'w-4 h-4')} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
        <div className={cn('flex items-center gap-3 px-3 py-2 mt-2', isCollapsed && 'justify-center')}>
          <UserButton afterSignOutUrl="/" userProfileMode="navigation" userProfileUrl="/dashboard/account" appearance={{ elements: { avatarBox: 'w-8 h-8' } }} />
          {!isCollapsed && <span className="text-sm text-slate-600">Account</span>}
        </div>
      </div>
    </div>
  )
  }

  return (
    <>
      <aside className={cn(
        'hidden lg:flex flex-col bg-white border-r border-slate-200 transition-all duration-300 flex-shrink-0',
        collapsed ? 'w-16' : 'w-64'
      )}>
        <SidebarContent />
      </aside>

      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-4 right-4 z-40 w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center shadow-lg"
      >
        <Menu className="w-5 h-5 text-amber-400" />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-white h-full shadow-2xl flex flex-col">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
            <SidebarContent mobile />
          </aside>
        </div>
      )}
    </>
  )
}