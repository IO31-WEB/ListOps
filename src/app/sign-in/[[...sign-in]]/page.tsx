import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { House } from 'lucide-react'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[var(--cream)] flex flex-col items-center justify-center px-4 py-16">
      <Link href="/" className="flex items-center gap-2.5 mb-10">
        <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
          <House className="w-4.5 h-4.5 text-amber-400" />
        </div>
        <span className="font-display font-semibold text-slate-900 text-xl">ListOps</span>
      </Link>
      <SignIn
        forceRedirectUrl="/dashboard"
        fallbackRedirectUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'shadow-xl border border-amber-100/80 rounded-2xl',
            headerTitle: 'font-display text-slate-900 text-2xl',
            headerSubtitle: 'text-slate-500',
            socialButtonsBlockButton: 'border border-slate-200 hover:bg-slate-50 transition-colors',
            formButtonPrimary: 'bg-slate-900 hover:bg-slate-800 text-amber-50 font-semibold',
            footerActionLink: 'text-amber-600 hover:text-amber-700',
          },
        }}
      />
    </div>
  )
}
