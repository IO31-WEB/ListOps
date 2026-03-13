/**
 * ATTOM Data Solutions — Property & Neighborhood Enrichment
 *
 * ATTOM provides a licensed, redistribution-safe REST API covering:
 *   - Demographics (population, income, age, education) by address/radius
 *   - Traffic volume data via their Transportation dataset
 *   - Consumer expenditure data via their Neighborhood dataset
 *   - School ratings, crime index, and property details
 *
 * Terms: ATTOM's API license explicitly permits use in SaaS applications
 * and derivative data products (confirm your tier's redistribution rights).
 * API docs: https://api.developer.attomdata.com/docs
 *
 * This module normalizes ATTOM responses into the same PropertyConsumerSpend /
 * PropertyDemographic / PropertyTrafficCount schema used by the PDF parser,
 * so the grading engine operates identically regardless of data source.
 *
 * Environment variables required:
 *   ATTOM_API_KEY  — from https://developer.attomdata.com/
 */

import type {
  PropertyConsumerSpend,
  PropertyDemographic,
  PropertyTrafficCount,
  PropertyHousingData,
} from '@/lib/db/schema'

const ATTOM_API_KEY = process.env.ATTOM_API_KEY
const ATTOM_BASE = 'https://api.developer.attomdata.com/propertyapi/v1.0.0'

// ── Error class ───────────────────────────────────────────────

export class AttomEnrichmentError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_API_KEY' | 'NOT_FOUND' | 'API_ERROR' | 'PARSE_ERROR',
    public readonly status?: number
  ) {
    super(message)
    this.name = 'AttomEnrichmentError'
  }
}

// ── ATTOM API response shapes (partial — only fields we use) ──

interface AttomGeoResponse {
  status: { code: number; msg: string }
  property?: Array<{
    identifier: { attomId: number }
    location: {
      latitude: number
      longitude: number
      line1: string
      line2: string
      locality: string
      countrySubd: string
      postal1: string
    }
  }>
}

interface AttomCommunityResponse {
  status: { code: number; msg: string }
  community?: {
    demographic?: {
      population?: number
      populationGrowth5Yr?: number
      medianAge?: number
      medianHouseholdIncome?: number
      averageHouseholdIncome?: number
      medianHomeValue?: number
      ownerOccupied?: number          // pct
      bachelorsOrHigher?: number      // pct
      age65Plus?: number              // pct
      hispanicOrLatino?: number       // pct
    }
    housing?: {
      medianHomeValue?: number
      ownerOccupied?: number
      totalUnits?: number
      medianYearBuilt?: number
    }
    expenditure?: {
      totalExpenditures?: number
      apparel?: number
      entertainment?: number
      foodAndBeverages?: number
      householdFurnishings?: number
      transportation?: number
      healthcare?: number
      education?: number
    }
  }
}

// ── Core public types ─────────────────────────────────────────

export interface AttomGeocode {
  attomId: number
  lat: number
  lng: number
  address: string
  city: string
  state: string
  zip: string
}

export interface AttomEnrichmentResult {
  geocode: AttomGeocode
  demographics: {
    oneMile: PropertyDemographic | null
    threeMile: PropertyDemographic | null
    fiveMile: PropertyDemographic | null
  }
  consumerSpend: {
    oneMile: PropertyConsumerSpend | null
    threeMile: PropertyConsumerSpend | null
    fiveMile: PropertyConsumerSpend | null
  }
  trafficCounts: PropertyTrafficCount[]
  housingData: PropertyHousingData | null
}

// ── Helpers ───────────────────────────────────────────────────

function attomHeaders() {
  return {
    Accept: 'application/json',
    apikey: ATTOM_API_KEY!,
  }
}

async function attomFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!ATTOM_API_KEY) {
    throw new AttomEnrichmentError(
      'ATTOM_API_KEY is not configured. Add it to your environment variables.',
      'NO_API_KEY'
    )
  }

  const url = new URL(`${ATTOM_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url.toString(), { headers: attomHeaders() })

  if (res.status === 404) {
    throw new AttomEnrichmentError(`ATTOM: Address not found`, 'NOT_FOUND', 404)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new AttomEnrichmentError(
      `ATTOM API error ${res.status}: ${text.slice(0, 200)}`,
      'API_ERROR',
      res.status
    )
  }

  try {
    return (await res.json()) as T
  } catch {
    throw new AttomEnrichmentError('Failed to parse ATTOM response as JSON', 'PARSE_ERROR')
  }
}

/**
 * Geocode a property address using ATTOM's property search endpoint.
 * Returns the attomId + lat/lng which are required for subsequent calls.
 */
export async function geocodeWithAttom(params: {
  address: string
  city?: string | null
  state?: string | null
  zip?: string | null
}): Promise<AttomGeocode> {
  const queryParams: Record<string, string> = {}

  if (params.zip) {
    queryParams.postalcode = params.zip
    queryParams.address1 = params.address
  } else if (params.city && params.state) {
    queryParams.address1 = params.address
    queryParams.address2 = `${params.city} ${params.state}`
  } else {
    queryParams.address1 = params.address
  }

  const data = await attomFetch<AttomGeoResponse>('/property/basicprofile', queryParams)

  const prop = data.property?.[0]
  if (!prop) {
    throw new AttomEnrichmentError(`No ATTOM property found for: ${params.address}`, 'NOT_FOUND')
  }

  return {
    attomId: prop.identifier.attomId,
    lat: prop.location.latitude,
    lng: prop.location.longitude,
    address: prop.location.line1,
    city: prop.location.locality,
    state: prop.location.countrySubd,
    zip: prop.location.postal1,
  }
}

/**
 * Fetch community/neighborhood data for a given radius.
 * ATTOM's community endpoint returns demographics, housing, and expenditure
 * data aggregated for the trade area around the subject property.
 *
 * Radius options: 1, 3, 5 (miles)
 */
async function fetchCommunityData(
  lat: number,
  lng: number,
  radiusMiles: 1 | 3 | 5
): Promise<AttomCommunityResponse['community'] | null> {
  try {
    const data = await attomFetch<AttomCommunityResponse>('/neighborhood/community', {
      latitude: String(lat),
      longitude: String(lng),
      radius: String(radiusMiles),
    })
    return data.community ?? null
  } catch (err) {
    // Non-fatal per radius — return null so caller can skip missing rings
    if (err instanceof AttomEnrichmentError && err.code === 'NOT_FOUND') return null
    throw err
  }
}

/**
 * Normalize ATTOM community demographic data to our PropertyDemographic schema.
 */
function normalizeDemographic(
  raw: AttomCommunityResponse['community'] | null
): PropertyDemographic | null {
  const d = raw?.demographic
  if (!d || d.population == null) return null
  return {
    population2024: d.population ?? 0,
    populationGrowth5yr: d.populationGrowth5Yr ?? 0,
    medianAge: d.medianAge ?? 0,
    medianHouseholdIncome: d.medianHouseholdIncome ?? 0,
    avgHouseholdIncome: d.averageHouseholdIncome ?? 0,
    medianHomeValue: d.medianHomeValue ?? 0,
    ownerOccupiedPct: d.ownerOccupied ?? 0,
    bachelorsPlusPct: d.bachelorsOrHigher ?? 0,
    age65PlusPct: d.age65Plus ?? 0,
    hispanicPct: d.hispanicOrLatino ?? 0,
  }
}

/**
 * Normalize ATTOM expenditure data to PropertyConsumerSpend.
 * ATTOM reports in actual dollars; we convert to $000s to match the
 * schema convention used by the PDF parser and grading engine.
 */
function normalizeConsumerSpend(
  raw: AttomCommunityResponse['community'] | null
): PropertyConsumerSpend | null {
  const e = raw?.expenditure
  if (!e || e.totalExpenditures == null) return null

  const toK = (v?: number) => v != null ? Math.round(v / 1000) : 0
  return {
    totalSpecified: toK(e.totalExpenditures),
    apparel: toK(e.apparel),
    entertainmentHobbies: toK(e.entertainment),
    foodAlcohol: toK(e.foodAndBeverages),
    household: toK(e.householdFurnishings),
    transportation: toK(e.transportation),
    healthcare: toK(e.healthcare),
    education: toK(e.education),
  }
}

function normalizeHousing(
  raw: AttomCommunityResponse['community'] | null
): PropertyHousingData | null {
  const h = raw?.housing
  if (!h || h.medianHomeValue == null) return null
  return {
    medianHomeValue: h.medianHomeValue ?? 0,
    ownerOccupiedPct: h.ownerOccupied ?? 0,
    totalUnits: h.totalUnits ?? 0,
    medianYearBuilt: h.medianYearBuilt ?? 0,
  }
}

/**
 * Main enrichment function. Fetches all three radius rings in parallel.
 * Individual ring failures are non-fatal — the result will contain nulls
 * for unavailable rings rather than throwing.
 *
 * Traffic data is not available via the ATTOM community endpoint; it
 * requires ATTOM's separate Transportation API or a traffic data add-on.
 * We return an empty array here — the grading engine handles missing traffic
 * gracefully by applying a data-gap penalty rather than crashing.
 */
export async function enrichWithAttom(params: {
  address: string
  city?: string | null
  state?: string | null
  zip?: string | null
}): Promise<AttomEnrichmentResult> {
  // Step 1: Geocode to get lat/lng + attomId
  const geocode = await geocodeWithAttom(params)

  // Step 2: Fetch all three radii in parallel
  const [ring1, ring3, ring5] = await Promise.allSettled([
    fetchCommunityData(geocode.lat, geocode.lng, 1),
    fetchCommunityData(geocode.lat, geocode.lng, 3),
    fetchCommunityData(geocode.lat, geocode.lng, 5),
  ])

  const community1 = ring1.status === 'fulfilled' ? ring1.value : null
  const community3 = ring3.status === 'fulfilled' ? ring3.value : null
  const community5 = ring5.status === 'fulfilled' ? ring5.value : null

  return {
    geocode,
    demographics: {
      oneMile: normalizeDemographic(community1),
      threeMile: normalizeDemographic(community3),
      fiveMile: normalizeDemographic(community5),
    },
    consumerSpend: {
      oneMile: normalizeConsumerSpend(community1),
      threeMile: normalizeConsumerSpend(community3),
      fiveMile: normalizeConsumerSpend(community5),
    },
    trafficCounts: [],   // Requires ATTOM Transportation API add-on
    housingData: normalizeHousing(community3), // 3-mile ring for housing data
  }
}
