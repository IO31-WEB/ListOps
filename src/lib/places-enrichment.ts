/**
 * Google Places API enrichment for anchor tenant data.
 *
 * When a CoStar report lacks nearby retailer data (e.g. consumer spend-only
 * PDFs), this module geocodes the property address and queries the Places API
 * for nearby retail establishments within a 1-mile radius.
 *
 * Results are normalized to CostarRetailer[] so they slot directly into the
 * existing grading engine without any changes to scoring logic.
 */

import type { CostarRetailer } from '@/lib/db/schema'

const PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY
const GEOCODING_API_KEY = process.env.GOOGLE_PLACES_API_KEY // same key

// Radius in meters — 1 mile ≈ 1609m, we search 1.5mi to catch close anchors
const SEARCH_RADIUS_METERS = 2414 // 1.5 miles

// Google place types → our retailer categories
const TYPE_CATEGORY_MAP: Record<string, CostarRetailer['category']> = {
  // Big box / department
  department_store: 'big_box',
  furniture_store: 'big_box',
  hardware_store: 'big_box',
  home_goods_store: 'big_box',
  electronics_store: 'big_box',
  // Grocery
  supermarket: 'grocery',
  // Pharmacy
  pharmacy: 'pharmacy',
  drugstore: 'pharmacy',
  // Food
  fast_food_restaurant: 'fast_food',
  meal_takeaway: 'fast_food',
  restaurant: 'fast_casual',
  cafe: 'fast_casual',
  // Default
  store: 'other',
  shopping_mall: 'big_box',
}

// Known big-box chains by name (Google doesn't always tag these correctly)
const BIG_BOX_NAMES = [
  'walmart', 'target', 'costco', "sam's club", "bj's wholesale",
  'home depot', "lowe's", 'best buy', "dick's sporting goods",
  'tj maxx', 't.j. maxx', 'marshalls', 'ross', 'burlington',
  'five below', 'dollar tree', 'dollar general', 'family dollar',
  'bed bath', 'michaels', 'hobby lobby', 'joann',
]

const GROCERY_NAMES = [
  'publix', 'kroger', 'whole foods', 'trader joe', 'aldi', 'sprouts',
  'winn-dixie', 'food lion', 'safeway', 'albertsons', 'wegmans',
  'heb', 'meijer', 'giant', 'stop & shop',
]

const FAST_CASUAL_NAMES = [
  'chipotle', 'panera', 'five guys', 'shake shack', 'sweetgreen',
  "chick-fil-a", "raising cane's", 'wingstop', 'panda express',
]

const FAST_FOOD_NAMES = [
  "mcdonald's", 'burger king', 'wendy', 'taco bell', 'subway',
  'domino', 'pizza hut', 'papa john', 'kfc', 'popeyes', 'sonic',
  "arby's", 'jack in the box', 'whataburger', "hardee's", "carl's jr",
]

function classifyByName(name: string): CostarRetailer['category'] | null {
  const lower = name.toLowerCase()
  if (BIG_BOX_NAMES.some((n) => lower.includes(n))) return 'big_box'
  if (GROCERY_NAMES.some((n) => lower.includes(n))) return 'grocery'
  if (FAST_CASUAL_NAMES.some((n) => lower.includes(n))) return 'fast_casual'
  if (FAST_FOOD_NAMES.some((n) => lower.includes(n))) return 'fast_food'
  return null
}

function metersToMiles(meters: number): number {
  return Math.round((meters / 1609.34) * 100) / 100
}

export interface EnrichmentResult {
  retailers: CostarRetailer[]
  lat: number
  lng: number
  source: 'google_places'
  placesQueried: number
}

export class PlacesEnrichmentError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_API_KEY' | 'GEOCODE_FAILED' | 'PLACES_FAILED' | 'NO_RESULTS'
  ) {
    super(message)
    this.name = 'PlacesEnrichmentError'
  }
}

/**
 * Geocode a street address to lat/lng using Google Geocoding API.
 */
export async function geocodeAddress(
  address: string,
  city: string | null,
  state: string | null,
  zip: string | null
): Promise<{ lat: number; lng: number }> {
  if (!GEOCODING_API_KEY) {
    throw new PlacesEnrichmentError(
      'GOOGLE_PLACES_API_KEY is not configured',
      'NO_API_KEY'
    )
  }

  const fullAddress = [address, city, state, zip].filter(Boolean).join(', ')
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${GEOCODING_API_KEY}`

  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== 'OK' || !data.results?.[0]) {
    throw new PlacesEnrichmentError(
      `Geocoding failed for "${fullAddress}": ${data.status}`,
      'GEOCODE_FAILED'
    )
  }

  const { lat, lng } = data.results[0].geometry.location
  return { lat, lng }
}

/**
 * Query Google Places Nearby Search for retail establishments.
 * Uses the Places API v1 (New) for richer data.
 */
async function searchNearbyPlaces(
  lat: number,
  lng: number
): Promise<any[]> {
  if (!PLACES_API_KEY) {
    throw new PlacesEnrichmentError('GOOGLE_PLACES_API_KEY is not configured', 'NO_API_KEY')
  }

  // Use Places API (New) — better type coverage than legacy
  const url = 'https://places.googleapis.com/v1/places:searchNearby'
  const body = {
    includedTypes: [
      'supermarket', 'department_store',
      'hardware_store', 'home_goods_store', 'electronics_store',
      'pharmacy', 'drugstore', 'shopping_mall', 'furniture_store',
      'fast_food_restaurant', 'meal_takeaway',
    ],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: SEARCH_RADIUS_METERS,
      },
    },
    rankPreference: 'DISTANCE',
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.displayName,places.types,places.location,places.rating,places.userRatingCount',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new PlacesEnrichmentError(`Places API error ${res.status}: ${err}`, 'PLACES_FAILED')
  }

  const data = await res.json()
  return data.places ?? []
}

/**
 * Calculate distance in meters between two lat/lng points (Haversine).
 */
function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Normalize a Places API result to CostarRetailer format.
 */
function normalizePlaceToRetailer(
  place: any,
  subjectLat: number,
  subjectLng: number
): CostarRetailer | null {
  const name: string = place.displayName?.text ?? place.name
  if (!name) return null

  const placeLat = place.location?.latitude
  const placeLng = place.location?.longitude
  if (!placeLat || !placeLng) return null

  const distanceMeters = haversineMeters(subjectLat, subjectLng, placeLat, placeLng)
  const distanceMiles = metersToMiles(distanceMeters)

  // Classify: name-based takes precedence over type-based
  const nameCategory = classifyByName(name)
  const typeCategory = place.types
    ?.map((t: string) => TYPE_CATEGORY_MAP[t])
    .find(Boolean) as CostarRetailer['category'] | undefined

  const category = nameCategory ?? typeCategory ?? 'other'

  // Filter out low-signal "other" with no name match — too noisy
  if (category === 'other' && !nameCategory) return null

  return {
    name,
    distanceMiles,
    salesVolumeK: null,   // not available from Places
    grade: null,
    direction: null,      // could compute bearing but not critical
    category,
  }
}

/**
 * Main enrichment entry point.
 * Geocodes the address (or uses existing lat/lng), queries Places, returns
 * normalized retailers ready to be stored in costar_reports.nearby_retailers.
 */
export async function enrichWithPlacesData(opts: {
  address: string
  city: string | null
  state: string | null
  zip: string | null
  lat?: number | null
  lng?: number | null
}): Promise<EnrichmentResult> {
  if (!PLACES_API_KEY) {
    throw new PlacesEnrichmentError('GOOGLE_PLACES_API_KEY is not configured', 'NO_API_KEY')
  }

  // Use existing coords or geocode
  let lat: number
  let lng: number

  if (opts.lat && opts.lng) {
    lat = opts.lat
    lng = opts.lng
  } else {
    const coords = await geocodeAddress(opts.address, opts.city, opts.state, opts.zip)
    lat = coords.lat
    lng = coords.lng
  }

  const places = await searchNearbyPlaces(lat, lng)

  const retailers: CostarRetailer[] = places
    .map((p) => normalizePlaceToRetailer(p, lat, lng))
    .filter((r): r is CostarRetailer => r !== null)
    // Deduplicate by name (Places can return same chain multiple times)
    .filter((r, i, arr) => arr.findIndex((x) => x.name.toLowerCase() === r.name.toLowerCase()) === i)
    .sort((a, b) => a.distanceMiles - b.distanceMiles)

  return {
    retailers,
    lat,
    lng,
    source: 'google_places',
    placesQueried: places.length,
  }
}
