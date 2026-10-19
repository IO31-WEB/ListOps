/**
 * Enrichment provider switch.
 *
 *   ENRICHMENT_PROVIDER=auto      (default) Realie first, RentCast as fallback
 *   ENRICHMENT_PROVIDER=realie | rentcast
 *   ENRICHMENT_PROVIDER=none      disables enrichment entirely (form still works manually)
 *
 * Providers that lack an API key are skipped automatically.
 */
import { captureError } from '@/lib/monitoring'
import { realie } from './realie'
import { rentcast } from './rentcast'
import type { EnrichedProperty, EnrichmentProvider, EnrichmentQuery } from './types'

export type { EnrichedProperty, EnrichmentQuery } from './types'

function activeProviders(): EnrichmentProvider[] {
  const mode = (process.env.ENRICHMENT_PROVIDER ?? 'auto').toLowerCase()
  const list: EnrichmentProvider[] =
    mode === 'none' ? [] : mode === 'realie' ? [realie] : mode === 'rentcast' ? [rentcast] : [realie, rentcast]
  return list.filter(p => p.isConfigured())
}

export function enrichmentEnabled(): boolean {
  return activeProviders().length > 0
}

/** Providers return decimals (e.g. 2.75 baths); the listing schema wants clean values. */
function normalize(p: EnrichedProperty): EnrichedProperty {
  const int = (n?: number) => (n && n > 0 ? Math.round(n) : undefined)
  const year = int(p.yearBuilt)
  return {
    ...p,
    bedrooms: int(p.bedrooms),
    bathrooms: p.bathrooms && p.bathrooms > 0 ? Math.round(p.bathrooms * 2) / 2 : undefined,
    sqft: int(p.sqft),
    yearBuilt: year && year >= 1600 && year <= new Date().getFullYear() + 2 ? year : undefined,
    features: Array.from(new Set(p.features)).slice(0, 25),
  }
}

export async function enrichAddress(q: EnrichmentQuery): Promise<EnrichedProperty | null> {
  for (const provider of activeProviders()) {
    try {
      const hit = await provider.lookup(q)
      if (hit) return normalize(hit)
    } catch (err) {
      // Log + move on to the next provider. The upstream body/URL is never surfaced to the client.
      captureError(err, { provider: provider.name })
    }
  }
  return null
}
