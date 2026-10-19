export interface EnrichmentQuery {
  address: string // street line 1 only
  city?: string
  state: string // 2-letter
  zip?: string
}

export interface EnrichedProperty {
  provider: 'realie' | 'rentcast'
  address?: string
  city?: string
  state?: string
  zip?: string
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  yearBuilt?: number
  propertyType?: string
  features: string[]
}

export interface EnrichmentProvider {
  name: 'realie' | 'rentcast'
  isConfigured(): boolean
  lookup(q: EnrichmentQuery): Promise<EnrichedProperty | null>
}
