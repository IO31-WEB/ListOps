import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'
import { House, Check } from 'lucide-react'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[var(--cream)] flex flex-col lg:flex-row">
      {/* Left side — value prop */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12 relative overflow-hidden grain">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full translate-x-1/2 translate-y-1/2" />

        <div className="relative">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
              <House className="w-4.5 h-4.5 text-slate-900" />
            </div>
            <span className="font-display font-semibold text-white text-xl">ListOps</span>
          </Link>
        </div>

        <div className="relative">
          <h2 className="font-display text-4xl font-semibold text-white leading-tight mb-8">
            Your first 3 campaigns are{' '}
            <em className="text-amber-400">completely free.</em>
          </h2>
          <ul className="space-y-4">
            {[
              'MLS-connected — no manual data entry',
              'Facebook, Instagram, Email & Flyer — all in ~2 min',
              'Brand kit keeps your identity consistent',
              'Cancel anytime, no credit card needed',
            ].map((item) => (
              <li key={item} className="flex items-center gap-3 text-slate-300 text-sm">
                <div className="w-6 h-6 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5 text-amber-400" />
                </div>
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10 bg-slate-800/60 rounded-xl p-5 border border-slate-700">
            <p className="text-slate-300 text-sm italic mb-3">
              "I used to spend 3 hours on marketing per listing. Now it takes about 2 minutes."
            </p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">SM</div>
              <div>
                <div className="text-white text-xs font-semibold">Sarah M.</div>
                <div className="text-slate-500 text-xs">REALTOR® • Austin, TX</div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative text-xs text-slate-600">
          © {new Date().getFullYear()} ListOps — Built for real estate agents
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {/* Mobile logo */}
        <Link href="/" className="flex lg:hidden items-center gap-2.5 mb-10">
          <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
            <House className="w-4.5 h-4.5 text-amber-400" />
          </div>
          <span className="font-display font-semibold text-slate-900 text-xl">ListOps</span>
        </Link>
        <SignUp
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
    </div>
  )
}
