import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin'

export const metadata = { title: 'Admin · ListOps', robots: { index: false, follow: false } }

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage() // layouts don't re-run on client navigation — each page ALSO checks.
  const nav = [['/admin', 'Overview'], ['/admin/users', 'Users'], ['/admin/failures', 'Failures'], ['/admin/audit', 'Audit log']]
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
          <span className="font-semibold">ListOps Admin</span>
          <nav className="flex gap-4 text-sm">
            {nav.map(([href, label]) => <Link key={href} href={href} prefetch={false} className="text-slate-300 hover:text-white">{label}</Link>)}
          </nav>
          <div className="ml-auto text-xs text-slate-400 flex items-center gap-3">
            <span>{admin.email}</span>
            <Link href="/dashboard" className="underline hover:text-white">Back to app</Link>
          </div>
        </div>
        <div className="bg-amber-500 text-slate-900 text-xs text-center py-1">Internal tool · every lookup and change is written to the audit log</div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
