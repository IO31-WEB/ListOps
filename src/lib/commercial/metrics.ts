/**
 * Commercial differentiators that cost nothing to run: pure arithmetic on numbers the broker typed in.
 * No network, no AI, no third-party data. Every output is labelled as derived from the broker's own inputs.
 *  - investmentSnapshot: price/SF, price/unit, price/acre, implied cap rate, value at a stated cap rate, NOI/SF
 *  - financingScenario: illustrative debt math from the broker's own assumptions (LTV, rate, amortization)
 *  - offeringReadiness: what a buyer/broker will ask for that the listing is still missing
 */
import type { CommercialDetails } from './types'

const fin = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

export interface SnapshotInput {
  price?: number | null; sqft?: number | null
  units?: number | null; lotAcres?: number | null; noi?: number | null; capRatePct?: number | null
}
export interface SnapshotRow { label: string; value: string; note?: string }

const usd = (n: number, d = 0) => `$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`

export function investmentSnapshot(i: SnapshotInput): SnapshotRow[] {
  const rows: SnapshotRow[] = []
  if (fin(i.price) && fin(i.sqft)) rows.push({ label: 'Price per SF', value: usd(i.price / i.sqft, 2) })
  if (fin(i.price) && fin(i.units)) rows.push({ label: 'Price per unit', value: usd(i.price / i.units) })
  if (fin(i.price) && fin(i.lotAcres)) rows.push({ label: 'Price per acre', value: usd(i.price / i.lotAcres) })
  if (fin(i.noi) && fin(i.sqft)) rows.push({ label: 'NOI per SF', value: usd(i.noi / i.sqft, 2) })
  if (fin(i.noi) && fin(i.units)) rows.push({ label: 'NOI per unit', value: usd(i.noi / i.units) })
  if (fin(i.noi) && fin(i.price)) {
    const implied = (i.noi / i.price) * 100
    const stated = fin(i.capRatePct) ? i.capRatePct : null
    rows.push({
      label: 'Implied cap rate (NOI ÷ price)', value: `${implied.toFixed(2)}%`,
      note: stated != null && Math.abs(implied - stated) > 0.25 ? `Differs from the ${stated}% you entered. Check price, NOI or cap rate before publishing.` : undefined,
    })
  }
  if (fin(i.noi) && fin(i.capRatePct)) rows.push({ label: 'Value at stated cap rate (NOI ÷ cap)', value: usd(i.noi / (i.capRatePct / 100)) })
  return rows
}

export interface FinancingInput { price: number; noi: number; ltvPct: number; ratePct: number; amortYears: number }
export interface FinancingResult {
  loan: number; equity: number; annualDebtService: number; dscr: number; debtYieldPct: number; cashOnCashPct: number
}

/** Standard fully amortizing monthly payment. Returns null for invalid inputs. */
export function financingScenario(i: FinancingInput): FinancingResult | null {
  if (!fin(i.price) || !fin(i.noi) || !(i.ltvPct > 0 && i.ltvPct <= 100) || !(i.ratePct >= 0 && i.ratePct <= 30) || !(i.amortYears >= 1 && i.amortYears <= 40)) return null
  const loan = i.price * (i.ltvPct / 100)
  const n = Math.round(i.amortYears * 12)
  const r = i.ratePct / 100 / 12
  const monthly = r === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n))
  const annualDebtService = monthly * 12
  const equity = i.price - loan
  return {
    loan, equity, annualDebtService,
    dscr: i.noi / annualDebtService,
    debtYieldPct: (i.noi / loan) * 100,
    cashOnCashPct: equity > 0 ? ((i.noi - annualDebtService) / equity) * 100 : 0,
  }
}

export interface ReadinessInput {
  details: CommercialDetails
  sqft?: number | null; price?: number | null; yearBuilt?: number | null
  photoCount: number; descriptionLength: number
}
export interface ReadinessItem { label: string; ok: boolean; weight: number; tip: string }

export function offeringReadiness(i: ReadinessInput): { score: number; items: ReadinessItem[] } {
  const d = i.details
  const sale = d.offering === 'sale'
  const items: ReadinessItem[] = [
    { label: 'Size', ok: fin(i.sqft) || fin(d.units) || fin(d.lotAcres), weight: 10, tip: 'Add square feet, units or acres. It is the first thing a buyer filters on.' },
    { label: sale ? 'Price or guidance' : 'Asking rent or guidance', ok: fin(i.price) || !!d.priceGuidance, weight: 10, tip: 'Add an asking figure or guidance such as "Offers invited". Silence on price lowers reply rates.' },
    { label: 'Zoning / permitted use', ok: !!d.zoning, weight: 8, tip: 'Add zoning or permitted use as the owner provided it.' },
    { label: 'Occupancy and lease notes', ok: !!d.occupancyNotes, weight: 10, tip: 'Add occupancy, tenants and lease terms you are able to share.' },
    { label: 'Year built', ok: fin(i.yearBuilt) || d.useType === 'land', weight: 5, tip: 'Add the year built (or renovated).' },
    { label: 'Photos (6 or more)', ok: i.photoCount >= 6, weight: 12, tip: 'Add exterior, interior, site and access photos. Six or more reads as a prepared offering.' },
    { label: 'Highlights (200+ characters)', ok: i.descriptionLength >= 200, weight: 12, tip: 'Describe access, frontage, building features and why it matters to a buyer or tenant.' },
    { label: 'Broker remarks', ok: !!d.brokerRemarks, weight: 5, tip: 'Add context that does not fit the fields: process, timing, what the owner wants.' },
  ]
  if (sale) {
    items.push({ label: 'NOI', ok: fin(d.noi), weight: 14, tip: 'Add NOI as the owner provided it. Investor buyers screen on it. It will be labelled subject to verification.' })
    items.push({ label: 'Cap rate', ok: fin(d.capRatePct), weight: 8, tip: 'Add the cap rate you are marketing at, or leave NOI and price to imply it.' })
  }
  if (d.useType === 'multifamily') items.push({ label: 'Unit count', ok: fin(d.units), weight: 8, tip: 'Multifamily buyers need the unit count.' })
  if (d.useType === 'land') items.push({ label: 'Acreage', ok: fin(d.lotAcres), weight: 8, tip: 'Land buyers need acreage.' })
  const total = items.reduce((s, x) => s + x.weight, 0)
  const got = items.reduce((s, x) => s + (x.ok ? x.weight : 0), 0)
  return { score: Math.round((got / total) * 100), items }
}
