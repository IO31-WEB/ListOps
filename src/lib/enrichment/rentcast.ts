/**
 * RentCast — property records fallback.
 * Docs: GET https://api.rentcast.io/v1/properties?address=<full address>
 *   header: X-Api-Key: <key>;  returns an ARRAY of property records.
 */
import type { EnrichmentProvider, EnrichedProperty, EnrichmentQuery } from './types'

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined

const TYPE_MAP: Record<string, string> = {
  'Single Family': 'Single Family',
  Condo: 'Condo',
  Townhouse: 'Townhouse',
  'Multi-Family': 'Multi-Family',
  Apartment: 'Multi-Family',
  Manufactured: 'Mobile/Manufactured',
  Land: 'Land',
}

export const rentcast: EnrichmentProvider = {
  name: 'rentcast',
  isConfigured: () => !!process.env.RENTCAST_API_KEY,

  async lookup(q: EnrichmentQuery): Promise<EnrichedProperty | null> {
    const full = [q.address, q.city, `${q.state}${q.zip ? ' ' + q.zip : ''}`].filter(Boolean).join(', ')
    const url = new URL('https://api.rentcast.io/v1/properties')
    url.searchParams.set('address', full)
    url.searchParams.set('limit', '1')

    const res = await fetch(url, {
      headers: { 'X-Api-Key': process.env.RENTCAST_API_KEY!, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`rentcast status ${res.status}`)

    const arr = (await res.json()) as Array<Record<string, unknown>>
    const p = Array.isArray(arr) ? arr[0] : undefined
    if (!p) return null

    const f = (p.features ?? {}) as Record<string, unknown>
    const features: string[] = []
    const spaces = num(f.garageSpaces)
    if (f.garage === true || spaces) features.push(spaces ? `${spaces}-Car Garage` : 'Garage')
    if (f.pool === true) features.push('Pool')
    if (f.fireplace === true) features.push('Fireplace')

    return {
      provider: 'rentcast',
      address: typeof p.addressLine1 === 'string' ? p.addressLine1 : undefined,
      city: typeof p.city === 'string' ? p.city : undefined,
      state: typeof p.state === 'string' ? p.state : undefined,
      zip: typeof p.zipCode === 'string' ? p.zipCode : undefined,
      bedrooms: num(p.bedrooms),
      bathrooms: num(p.bathrooms),
      sqft: num(p.squareFootage),
      yearBuilt: num(p.yearBuilt),
      propertyType: typeof p.propertyType === 'string' ? TYPE_MAP[p.propertyType] : undefined,
      features,
    }
  },
}
