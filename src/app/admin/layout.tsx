import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin'

export const metadata = { title: 'Admin · ListOps', robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage() // layouts don't re-run on client navigation — each page ALSO checks.
  const nav = [['/admin', 'Overview'], ['/admin/users', 'Users'], ['/admin/referrals', 'Referrals'], ['/admin/failures', 'Failures'], ['/admin/audit', 'Audit log']]
  return (
    <div className="min-h-screen bg-slate-100 overflow-x-hidden">
      <div className="sticky top-0 z-30 bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 md:py-0 md:h-14 flex flex-wrap md:flex-nowrap items-center gap-x-4 gap-y-1 md:gap-6">
          <span className="font-semibold shrink-0">ListOps Admin</span>
          {/* Mobile: second row, horizontally scrollable pill bar inside its own container. Desktop: inline links. */}
          <nav aria-label="Admin" className="order-last md:order-none w-full md:w-auto -mx-3 px-3 sm:-mx-4 sm:px-4 md:mx-0 md:px-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-2 md:gap-4 text-sm whitespace-nowrap pb-1 md:pb-0">
              {nav.map(([href, label]) => (
                <Link key={href} href={href} prefetch={false} className="inline-flex items-center min-h-10 md:min-h-0 rounded-full md:rounded-none bg-slate-800 md:bg-transparent px-4 md:px-0 text-slate-200 md:text-slate-300 hover:text-white">{label}</Link>
              ))}
            </div>
          </nav>
          <div className="ml-auto min-w-0 text-xs text-slate-400 flex items-center gap-3">
            <span className="hidden sm:block truncate max-w-[16rem]">{admin.email}</span>
            <Link href="/dashboard" className="shrink-0 inline-flex items-center min-h-10 md:min-h-0 underline hover:text-white">Back to app</Link>
          </div>
        </div>
      </div>
      <div className="bg-amber-500 text-slate-900 text-xs text-center py-1 px-3">Internal tool · every lookup and change is written to the audit log</div>
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">{children}</main>
    </div>
  )
}
