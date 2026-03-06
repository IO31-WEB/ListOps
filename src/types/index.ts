// ── Plan tiers ────────────────────────────────────────────────
export type PlanTier = 'free' | 'starter' | 'pro' | 'brokerage' | 'enterprise'

export type BillingInterval = 'month' | 'year'

// ── User / Org ────────────────────────────────────────────────
export type UserRole = 'owner' | 'admin' | 'agent'

export interface UserProfile {
  id: string
  clerkId: string
  email: string
  firstName: string | null
  lastName: string | null
  role: UserRole
  orgId: string
  campaignsUsedThisMonth: number
  createdAt: Date
}

export interface Organization {
  id: string
  name: string
  slug: string
  plan: PlanTier
  maxAgents: number
  stripeCustomerId: string | null
  createdAt: Date
}

// ── Brand Kit ─────────────────────────────────────────────────
export type AgentTone = 'professional' | 'friendly' | 'luxury' | 'energetic' | 'conversational'

export interface BrandKit {
  id: string
  orgId: string
  agentName: string | null
  agentTitle: string | null
  brokerageName: string | null
  logoUrl: string | null
  agentPhotoUrl: string | null
  primaryColor: string | null
  accentColor: string | null
  tone: AgentTone
  instagramHandle: string | null
  facebookUrl: string | null
  websiteUrl: string | null
  licenseNumber: string | null
  phoneNumber: string | null
  updatedAt: Date
}

// ── Listings ──────────────────────────────────────────────────
export type ListingStatus = 'active' | 'pending' | 'sold' | 'withdrawn'

export interface Listing {
  id: string
  mlsId: string
  address: string
  city: string
  state: string
  zip: string
  price: number
  beds: number | null
  baths: number | null
  sqft: number | null
  yearBuilt: number | null
  propertyType: string | null
  description: string | null
  features: string[]
  photos: string[]
  status: ListingStatus
  listDate: Date | null
}

// ── Campaigns ─────────────────────────────────────────────────
export type CampaignStatus = 'generating' | 'complete' | 'failed' | 'archived'

export interface CampaignContent {
  facebook: FacebookPost[]
  instagram: InstagramPost[]
  emailJustListed: string
  emailStillAvailable: string
  flyer: FlyerData
  videoScript?: string
}

export interface FacebookPost {
  week: number
  theme: string
  copy: string
}

export interface InstagramPost {
  week: number
  caption: string
  hashtags: string[]
}

export interface FlyerData {
  headline: string
  tagline: string
  features: string[]
  callToAction: string
}

export interface Campaign {
  id: string
  orgId: string
  userId: string
  listingId: string | null
  mlsId: string
  status: CampaignStatus
  content: CampaignContent | null
  micrositeSlug: string | null
  generationMs: number | null
  tokensUsed: number | null
  createdAt: Date
  listing?: Listing
}

// ── Subscriptions ─────────────────────────────────────────────
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid'

export interface Subscription {
  id: string
  orgId: string
  stripeSubscriptionId: string
  stripePriceId: string
  plan: PlanTier
  status: SubscriptionStatus
  interval: BillingInterval
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  trialEnd: Date | null
}

// ── API response types ────────────────────────────────────────
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface GenerateCampaignRequest {
  mlsId: string
  brandKitId?: string
}

export interface GenerateCampaignResponse {
  campaignId: string
  content: CampaignContent
  generationMs: number
  tokensUsed: number
}

export interface CreateCheckoutRequest {
  priceId: string
  interval: BillingInterval
}

export interface CreateCheckoutResponse {
  url: string
}
