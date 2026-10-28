/** Missing-branding checker. Pure. `required` items are things most MLS/state ad rules expect on marketing. */

export interface BrandWarning { id: string; level: 'required' | 'recommended'; message: string; fix: string }

interface BrandLike {
  agentName?: string | null; agentPhone?: string | null; agentEmail?: string | null; brokerageName?: string | null
  logoUrl?: string | null; agentPhotoUrl?: string | null; disclaimer?: string | null
}

export function brandWarnings(bk: BrandLike | null | undefined, opts: { licenseNumber?: string | null } = {}): BrandWarning[] {
  const b = bk ?? {}
  const blank = (v?: string | null) => !v || !v.trim()
  const out: BrandWarning[] = []
  if (blank(b.agentName)) out.push({ id: 'agentName', level: 'required', message: 'Your name is missing', fix: 'Add your full name so materials identify the licensee.' })
  if (blank(b.brokerageName)) out.push({ id: 'brokerageName', level: 'required', message: 'Brokerage name is missing', fix: 'Most states require the brokerage name in advertising.' })
  if (blank(opts.licenseNumber)) out.push({ id: 'license', level: 'required', message: 'License number is missing', fix: 'Add your license number — some states require it on ads.' })
  if (blank(b.disclaimer)) out.push({ id: 'disclaimer', level: 'required', message: 'No legal disclaimer', fix: 'Add your disclaimer, e.g. "Equal Housing Opportunity. Information deemed reliable but not guaranteed."' })
  else if (!/equal housing/i.test(b.disclaimer!)) out.push({ id: 'equalHousing', level: 'recommended', message: 'Disclaimer has no Equal Housing statement', fix: 'Add "Equal Housing Opportunity" to your disclaimer.' })
  if (blank(b.agentPhone) && blank(b.agentEmail)) out.push({ id: 'contact', level: 'required', message: 'No phone or email', fix: 'Buyers need a way to reach you on every piece.' })
  if (blank(b.logoUrl)) out.push({ id: 'logo', level: 'recommended', message: 'No logo uploaded', fix: 'Upload a logo for flyers, graphics and the microsite.' })
  if (blank(b.agentPhotoUrl)) out.push({ id: 'photo', level: 'recommended', message: 'No headshot uploaded', fix: 'A headshot makes flyers and graphics feel personal.' })
  return out
}
