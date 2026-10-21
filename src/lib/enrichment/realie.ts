/**
 * Realie — public-records property lookup.
 * GET https://app.realie.ai/api/public/property/address/?state=SC&address=<street line 1 only>
 * Header: Authorization: <api key>   (no "Bearer" prefix).  404 = address not found.
 *
 * TWO RESPONSE SHAPES EXIST (verified against docs.realie.ai, "Property Data Schema"):
 *  - v3 (default for new accounts): nested — property.buildingInformation.buildings[], roomInformation, ...
 *  - v2 "legacy flat" (accounts that haven't switched on v3): totalBedrooms, buildingArea, yearBuilt, ...
 * Fields with no value are OMITTED (not null). mapRealieProperty() reads v3 paths first and falls back to
 * the flat names, so it works on either account setting.
 *
 * Drift protection: if a successful response yields NONE of the core facts, that almost always means Realie
 * changed field names — we report it (keys only, never values) instead of silently returning an empty form.
 */
import { captureError } from '@/lib/monitoring'
import type { EnrichmentProvider, EnrichedProperty, EnrichmentQuery } from './types'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Safe nested read: dig(p, 'roomInformation', 'bedCount') */
function dig(o: unknown, ...path: string[]): unknown {
  let cur: unknown = o
  for (const k of path) {
    if (!isObj(cur)) return undefined
    cur = cur[k]
  }
  return cur
}

const posNum = (...candidates: unknown[]): number | undefined => {
  for (const v of candidates) if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  return undefined
}
const str = (...candidates: unknown[]): string | undefined => {
  for (const v of candidates) if (typeof v === 'string' && v.trim()) return v.trim()
  return undefined
}

/** The primary building = buildingNumber 1 if present, else the first entry. */
function primaryBuilding(p: Obj): Obj | undefined {
  const list = dig(p, 'buildingInformation', 'buildings')
  if (!Array.isArray(list) || !list.length) return undefined
  const objs = list.filter(isObj)
  return objs.find(b => b.buildingNumber === 1) ?? objs[0]
}

/** Pure + exported so it can be unit-tested with real payload fixtures. */
export function mapRealieProperty(p: Obj): EnrichedProperty {
  const b = primaryBuilding(p)

  const garageCount = posNum(b?.garageCount, p.garageCount)
  const hasGarage = b?.garage === true || p.garage === true || p.hasGarage === true || !!garageCount
  const hasPool =
    b?.pool === true || dig(b, 'characteristics', 'pool', 'exists') === true ||
    dig(p, 'building', 'pool', 'exists') === true || p.pool === true || p.hasPool === true
  const fireplaces = posNum(b?.fireplaceCount, p.fireplaceCount)
  const hasFireplace = b?.fireplace === true || p.fireplace === true || p.hasFireplace === true || !!fireplaces
  const stories = posNum(b?.stories, p.stories)

  const features: string[] = []
  if (hasGarage) features.push(garageCount ? `${garageCount}-Car Garage` : 'Garage')
  if (hasPool) features.push('Pool')
  if (hasFireplace) features.push(fireplaces && fireplaces > 1 ? `${fireplaces} Fireplaces` : 'Fireplace')
  if (stories && stories >= 2) features.push(`${Math.floor(stories)}-Story`)

  // Property type: only what is unambiguous. (Realie's building-type codes need their decode table, and
  // a house vs. townhouse can't be told apart from the flags, so we leave the rest for the agent to pick.)
  let propertyType: string | undefined
  const units = posNum(dig(p, 'generalInformation', 'numberOfUnits'))
  if (dig(p, 'propertyClassification', 'condo') === true) propertyType = 'Condo'
  else if (units && units >= 2) propertyType = 'Multi-Family'

  return {
    provider: 'realie',
    address: str(p.address, dig(p, 'propertyLocation', 'address'), dig(p, 'propertyLocation', 'addressLine1')),
    city: str(dig(p, 'propertyLocation', 'city'), dig(p, 'propertyIdentification', 'city'), p.city),
    state: str(p.state, dig(p, 'propertyLocation', 'state')),
    zip: str(p.zipCode, dig(p, 'propertyLocation', 'zipCode')),
    bedrooms: posNum(dig(p, 'roomInformation', 'bedCount'), b?.totalBedrooms, p.totalBedrooms, p.bedrooms),
    bathrooms: posNum(dig(p, 'roomInformation', 'bathCount'), b?.totalBathrooms, p.totalBathrooms, p.bathrooms),
    // livingArea = heated/finished living area (what listings advertise); buildingArea can include garage etc.
    sqft: posNum(b?.livingArea, p.livingArea, b?.buildingArea, p.buildingArea),
    yearBuilt: posNum(b?.actualYearBuilt, p.yearBuilt, p.actualYearBuilt),
    propertyType,
    features,
  }
}

const hasCoreFacts = (e: EnrichedProperty) => !!(e.bedrooms || e.bathrooms || e.sqft || e.yearBuilt)

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

    const body = (await res.json()) as { property?: unknown }
    if (!isObj(body.property)) return null

    const mapped = mapRealieProperty(body.property)
    if (!hasCoreFacts(mapped)) {
      // A property record came back but we extracted nothing useful -> probably a schema change.
      // Report the SHAPE only (key names), never the values, so no property data lands in Sentry.
      captureError(new Error('Realie response had no recognizable core fields (schema drift?)'), {
        topLevelKeys: Object.keys(body.property).slice(0, 60),
        buildingKeys: Object.keys(primaryBuilding(body.property) ?? {}).slice(0, 60),
      })
      return null // let the next provider (RentCast) try
    }
    return mapped
  },
}
