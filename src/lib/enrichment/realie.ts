/**
 * Realie — public-records property lookup.
 * Docs: GET https://app.realie.ai/api/public/property/address/
 *   query: state (required, 2-letter), address (street line 1 ONLY)
 *   header: Authorization: <api key>   (no "Bearer" prefix)
 *   200 -> { property: {...} }, 404 -> address not found.
 * Fields with no value are omitted from the response, so every read is optional.
 */
import type { EnrichmentProvider, EnrichedProperty, EnrichmentQuery } from './types'

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined

export const realie: EnrichmentProvider = {
  name: 'realie',
  isConfigured: () => !!process.env.REALIE_API_KEY,

  async lookup(q: EnrichmentQuery): Promise<EnrichedProperty | null> {
    const url = new URL('https://app.realie.ai/api/public/property/address/')
    url.searchParams.set('state', q.state)
    url.searchParams.set('address', q.address)

    const res = await fetch(url, {
      headers: { Authorization: process.env.REALIE_API_KEY! },
      signal: AbortSignal.timeout(5000),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`realie status ${res.status}`)

    const body = (await res.json()) as { property?: Record<string, unknown> }
    const p = body.property
    if (!p || typeof p !== 'object') return null

    const features: string[] = []
    if (num(p.garageCount)) features.push(`${num(p.garageCount)}-Car Garage`)
    if (p.hasPool === true || p.pool === true) features.push('Pool')
    if (p.hasFireplace === true || num(p.fireplaceCount)) features.push('Fireplace')
    if (num(p.stories) && (num(p.stories) as number) > 1) features.push(`${num(p.stories)}-Story`)

    return {
      provider: 'realie',
      address: typeof p.addressLine1 === 'string' ? p.addressLine1 : undefined,
      city: typeof p.city === 'string' ? p.city : undefined,
      state: typeof p.state === 'string' ? p.state : undefined,
      zip: typeof p.zipCode === 'string' ? p.zipCode : undefined,
      bedrooms: num(p.totalBedrooms),
      bathrooms: num(p.totalBathrooms),
      sqft: num(p.buildingArea),
      yearBuilt: num(p.yearBuilt),
      features,
    }
  },
}
