import Link from 'next/link'
import { LogoMark } from '@/components/ui/logo'
import { pageMetadata } from '@/lib/seo'
import { LEGAL_UPDATED } from '@/lib/legal'

export const metadata = pageMetadata({ title: 'Copyright Complaints (DMCA)', description: 'How to report copyright infringement on ListOps and how to submit a counter-notification.', path: '/dmca' })

/**
 * Designated-agent details come from env vars so you can fill them in once your Copyright Office
 * registration is complete (see MIGRATION_AND_SECURITY.md). The details shown HERE must exactly match
 * what is filed in the Copyright Office DMCA Designated Agent Directory (17 U.S.C. § 512(c)(2)).
 */
function agent() {
  return {
    name: process.env.DMCA_AGENT_NAME?.trim() || '',
    company: process.env.DMCA_AGENT_COMPANY?.trim() || 'ListOps',
    address: process.env.DMCA_AGENT_ADDRESS?.trim() || '',
    phone: process.env.DMCA_AGENT_PHONE?.trim() || '',
    email: process.env.DMCA_AGENT_EMAIL?.trim() || 'dmca@listops.io',
  }
}

export default function DmcaPage() {
  const a = agent()
  const registered = Boolean(a.name && a.address)
  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-amber-100/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="w-8 h-8" />
            <span className="font-display font-semibold text-slate-900 text-lg">ListOps</span>
          </Link>
        </div>
      </nav>
      <div className="pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
        <h1 className="font-display text-4xl font-semibold text-slate-900 mb-2">Copyright Complaints (DMCA)</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: {LEGAL_UPDATED}</p>

        <div className="space-y-8 text-slate-600 leading-relaxed text-sm">
          <section>
            <h2 className="font-display text-lg font-semibold text-slate-900 mb-2">Our policy</h2>
            <p>ListOps respects intellectual property rights. Users upload listing photos and other content to our service and are required to own or have permission to use everything they upload. We respond to notices of alleged copyright infringement that comply with the Digital Millennium Copyright Act (17 U.S.C. § 512), and we terminate the accounts of users who are repeat infringers in appropriate circumstances.</p>
          </section>

          <section id="agent" className="scroll-mt-28">
            <h2 className="font-display text-lg font-semibold text-slate-900 mb-2">Designated copyright agent</h2>
            <p className="mb-3">Send notices and counter-notifications to our designated agent:</p>
            <address className="not-italic bg-white border border-slate-200 rounded-xl p-5 space-y-1 text-slate-700">
              {a.name && <div><strong>{a.name}</strong></div>}
              <div>{a.company}</div>
              {a.address && <div className="whitespace-pre-line">{a.address}</div>}
              {a.phone && <div>Phone: {a.phone}</div>}
              <div>Email: <a className="underline text-amber-700" href={`mailto:${a.email}`}>{a.email}</a></div>
            </address>
            {!registered && <p className="mt-3 text-xs text-slate-400">Email is the fastest way to reach us.</p>}
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-slate-900 mb-2">How to file a notice of infringement</h2>
            <p className="mb-2">Your written notice must include all of the following (17 U.S.C. § 512(c)(3)(A)):</p>
            <ol className="list-decimal pl-6 space-y-1.5">
              <li>Your physical or electronic signature (or that of a person authorized to act for the copyright owner).</li>
              <li>Identification of the copyrighted work you claim has been infringed (or a representative list if several works are covered by one notice).</li>
              <li>Identification of the material you claim is infringing and enough information for us to find it (for example, the URL of the page, campaign or flyer where it appears).</li>
              <li>Your name, mailing address, telephone number and email address.</li>
              <li>A statement that you have a good-faith belief that the use is not authorized by the copyright owner, its agent, or the law.</li>
              <li>A statement, made under penalty of perjury, that the information in the notice is accurate and that you are the copyright owner or authorized to act on the owner&apos;s behalf.</li>
            </ol>
            <p className="mt-3">Please note that under 17 U.S.C. § 512(f), anyone who knowingly materially misrepresents that material is infringing may be liable for damages, including costs and attorneys&apos; fees. If you are unsure whether material infringes, consider speaking with a lawyer first.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-slate-900 mb-2">What happens next</h2>
            <p>When we receive a valid notice we will promptly remove or disable access to the identified material and notify the user who uploaded it, including a copy of the notice (with your contact details).</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-slate-900 mb-2">Counter-notification</h2>
            <p className="mb-2">If you believe material was removed by mistake or misidentification, you may send a counter-notification to our designated agent that includes (17 U.S.C. § 512(g)(3)):</p>
            <ol className="list-decimal pl-6 space-y-1.5">
              <li>Your physical or electronic signature.</li>
              <li>Identification of the material that was removed and where it appeared before removal.</li>
              <li>A statement, under penalty of perjury, that you have a good-faith belief the material was removed as a result of mistake or misidentification.</li>
              <li>Your name, address and telephone number, and a statement that you consent to the jurisdiction of the federal court for your address (or, if outside the United States, any judicial district in which ListOps may be found) and that you will accept service of process from the person who submitted the original notice.</li>
            </ol>
            <p className="mt-3">We will forward the counter-notification to the original complainant. Unless the complainant notifies us within 10 business days that they have filed a court action seeking an order against you, we may restore the material in no less than 10 and no more than 14 business days.</p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-slate-900 mb-2">Repeat infringers</h2>
            <p>Accounts that receive multiple valid copyright notices that are not successfully counter-noticed are subject to suspension or termination.</p>
          </section>

          <p className="text-xs text-slate-400">This page concerns copyright only. For other concerns, see our <Link href="/terms" className="underline">Terms</Link> or <Link href="/contact" className="underline">contact us</Link>.</p>
        </div>
      </div>
    </div>
  )
}
