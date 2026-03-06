/**
 * CampaignAI — Drizzle ORM Schema
 * Production-grade multi-tenant PostgreSQL schema
 * Designed for 1M+ users and $10M ARR scale
 */

import {
  pgTable, pgEnum, uuid, text, integer, boolean,
  timestamp, jsonb, numeric, index, uniqueIndex, inet,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── Enums ─────────────────────────────────────────────────────

export const tierEnum = pgEnum('tier', ['free', 'starter', 'pro', 'brokerage', 'enterprise'])
export const roleEnum = pgEnum('role', ['owner', 'admin', 'agent', 'viewer'])
export const subStatusEnum = pgEnum('sub_status', ['trialing', 'active', 'past_due', 'canceled', 'paused'])
export const campaignStatusEnum = pgEnum('campaign_status', ['generating', 'complete', 'failed', 'draft'])
export const listingStatusEnum = pgEnum('listing_status', ['active', 'pending', 'sold', 'withdrawn'])
export const billingIntervalEnum = pgEnum('billing_interval', ['month', 'year'])

// ── Organizations (Multi-tenant root) ─────────────────────────

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),                          // subdomain for white-label
  plan: tierEnum('plan').notNull().default('free'),

  // White-label config (brokerage/enterprise)
  whiteLabel: boolean('white_label').notNull().default(false),
  customDomain: text('custom_domain'),                   // e.g. marketing.reedrealty.com
  customAppName: text('custom_app_name'),                // e.g. "Reed Marketing Suite"
  customLogoUrl: text('custom_logo_url'),
  customFaviconUrl: text('custom_favicon_url'),
  customPrimaryColor: text('custom_primary_color'),
  customAccentColor: text('custom_accent_color'),
  customSupportEmail: text('custom_support_email'),
  hidePoweredBy: boolean('hide_powered_by').notNull().default(false),

  // MLS configuration
  mlsBoards: text('mls_boards').array().default([]),

  // Stripe
  stripeCustomerId: text('stripe_customer_id'),

  // Limits
  maxAgents: integer('max_agents').notNull().default(1),
  campaignsPerAgentPerMonth: integer('campaigns_per_agent_per_month').notNull().default(3),

  // SSO (enterprise)
  samlEnabled: boolean('saml_enabled').notNull().default(false),
  samlConfig: jsonb('saml_config'),

  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  slugIdx: uniqueIndex('org_slug_idx').on(t.slug),
  customDomainIdx: uniqueIndex('org_custom_domain_idx').on(t.customDomain),
}))

// ── Users ─────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull(),                   // Clerk user_id
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  role: roleEnum('role').notNull().default('agent'),

  // Profile
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  licenseNumber: text('license_number'),
  mlsAgentId: text('mls_agent_id'),
  avatarUrl: text('avatar_url'),
  timezone: text('timezone').notNull().default('America/New_York'),

  // AI Persona (custom writing style per agent)
  aiPersona: jsonb('ai_persona').$type<{
    tone: 'professional' | 'friendly' | 'luxury' | 'energetic'
    writingStyle: string
    tagline: string
    specialties: string[]
    marketArea: string
  }>(),

  // Usage tracking
  campaignsUsedThisMonth: integer('campaigns_used_this_month').notNull().default(0),
  campaignsUsedTotal: integer('campaigns_used_total').notNull().default(0),
  lastResetAt: timestamp('last_reset_at').notNull().defaultNow(),

  // Referral
  referralCode: text('referral_code'),
  referredBy: uuid('referred_by'),

  // Onboarding
  onboardingComplete: boolean('onboarding_complete').notNull().default(false),
  onboardingStep: integer('onboarding_step').notNull().default(0),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  clerkIdIdx: uniqueIndex('user_clerk_id_idx').on(t.clerkId),
  emailIdx: uniqueIndex('user_email_idx').on(t.email),
  orgIdIdx: index('user_org_id_idx').on(t.orgId),
  referralCodeIdx: uniqueIndex('user_referral_code_idx').on(t.referralCode),
}))

// ── Brand Kits ────────────────────────────────────────────────

export const brandKits = pgTable('brand_kits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),

  // Visual identity
  logoUrl: text('logo_url'),
  agentPhotoUrl: text('agent_photo_url'),
  primaryColor: text('primary_color').notNull().default('#1e293b'),
  accentColor: text('accent_color').notNull().default('#f59e0b'),
  fontFamily: text('font_family').notNull().default('Georgia'),

  // Agent identity
  agentName: text('agent_name'),
  agentTitle: text('agent_title').notNull().default('REALTOR®'),
  agentPhone: text('agent_phone'),
  agentEmail: text('agent_email'),
  agentWebsite: text('agent_website'),
  brokerageName: text('brokerage_name'),
  brokerageLogo: text('brokerage_logo'),
  tagline: text('tagline'),
  disclaimer: text('disclaimer'),   // legal disclaimer for print

  // Social handles
  facebookUrl: text('facebook_url'),
  instagramHandle: text('instagram_handle'),
  linkedinUrl: text('linkedin_url'),

  isDefault: boolean('is_default').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  userIdIdx: index('brand_kit_user_id_idx').on(t.userId),
}))

// ── Subscriptions ─────────────────────────────────────────────

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id),   // null = org-level sub

  stripeSubscriptionId: text('stripe_subscription_id'),
  stripePriceId: text('stripe_price_id'),
  stripeCurrentPeriodEnd: timestamp('stripe_current_period_end'),

  plan: tierEnum('plan').notNull().default('free'),
  status: subStatusEnum('status').notNull().default('trialing'),
  billingInterval: billingIntervalEnum('billing_interval').notNull().default('month'),

  // Trial
  trialEndsAt: timestamp('trial_ends_at'),
  trialCampaignsUsed: integer('trial_campaigns_used').notNull().default(0),

  // Cancel flow
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  canceledAt: timestamp('canceled_at'),
  cancellationReason: text('cancellation_reason'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  orgIdIdx: index('sub_org_id_idx').on(t.orgId),
  stripeSubIdx: uniqueIndex('sub_stripe_id_idx').on(t.stripeSubscriptionId),
}))

// ── Listings (MLS cache) ──────────────────────────────────────

export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  mlsId: text('mls_id').notNull(),
  mlsBoard: text('mls_board').notNull().default('simplyrets'),
  agentId: uuid('agent_id').notNull().references(() => users.id),
  orgId: uuid('org_id').references(() => organizations.id),

  // Property data
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  price: numeric('price'),
  bedrooms: integer('bedrooms'),
  bathrooms: numeric('bathrooms'),
  sqft: integer('sqft'),
  yearBuilt: integer('year_built'),
  propertyType: text('property_type'),
  description: text('description'),
  features: text('features').array().default([]),
  photos: text('photos').array().default([]),

  // Agent/Office from MLS
  listingAgentName: text('listing_agent_name'),
  listingAgentEmail: text('listing_agent_email'),
  listingAgentPhone: text('listing_agent_phone'),
  officeName: text('office_name'),

  // Cache management
  rawData: jsonb('raw_data'),
  status: listingStatusEnum('status').notNull().default('active'),
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  mlsIdBoardIdx: uniqueIndex('listing_mls_id_board_idx').on(t.mlsId, t.mlsBoard),
  agentIdIdx: index('listing_agent_id_idx').on(t.agentId),
}))

// ── Campaigns ─────────────────────────────────────────────────

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  listingId: uuid('listing_id').references(() => listings.id),
  agentId: uuid('agent_id').notNull().references(() => users.id),
  orgId: uuid('org_id').references(() => organizations.id),
  brandKitId: uuid('brand_kit_id').references(() => brandKits.id),

  status: campaignStatusEnum('status').notNull().default('generating'),
  generationMs: integer('generation_ms'),

  // Generated content
  facebookPosts: jsonb('facebook_posts').$type<Array<{
    week: number
    theme: string
    copy: string
    hashtags: string[]
    scheduledAt?: string
    publishedAt?: string
  }>>(),
  instagramPosts: jsonb('instagram_posts').$type<Array<{
    week: number
    caption: string
    hashtags: string[]
    scheduledAt?: string
    publishedAt?: string
  }>>(),
  emailJustListed: text('email_just_listed'),
  emailStillAvailable: text('email_still_available'),
  flyerUrl: text('flyer_url'),                           // R2 PDF URL
  videoScript: text('video_script'),                     // Pro feature

  // Microsite
  micrositeSlug: text('microsite_slug'),
  micrositePublished: boolean('microsite_published').notNull().default(false),
  micrositeViews: integer('microsite_views').notNull().default(0),

  // Scheduling / publishing
  publishedChannels: text('published_channels').array().default([]),
  scheduledPublishAt: timestamp('scheduled_publish_at'),

  // Analytics
  analytics: jsonb('analytics').$type<{
    facebookClicks?: number
    instagramReach?: number
    emailOpens?: number
    flyerDownloads?: number
  }>().default({}),

  // AI metadata
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  agentIdIdx: index('campaign_agent_id_idx').on(t.agentId),
  createdAtIdx: index('campaign_created_at_idx').on(t.createdAt),
  micrositeSlugIdx: uniqueIndex('campaign_microsite_slug_idx').on(t.micrositeSlug),
}))

// ── Audit Logs (Enterprise compliance) ───────────────────────

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: uuid('resource_id'),
  metadata: jsonb('metadata'),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  orgIdIdx: index('audit_org_id_idx').on(t.orgId),
  createdAtIdx: index('audit_created_at_idx').on(t.createdAt),
}))

// ── Referrals ─────────────────────────────────────────────────

export const referrals = pgTable('referrals', {
  id: uuid('id').primaryKey().defaultRandom(),
  referrerId: uuid('referrer_id').notNull().references(() => users.id),
  referredUserId: uuid('referred_user_id').references(() => users.id),
  referredEmail: text('referred_email').notNull(),
  status: text('status').notNull().default('pending'),   // pending | signed_up | upgraded
  rewardGranted: boolean('reward_granted').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ── Relations ─────────────────────────────────────────────────

export const organizationRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  campaigns: many(campaigns),
  subscriptions: many(subscriptions),
  auditLogs: many(auditLogs),
}))

export const userRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, { fields: [users.orgId], references: [organizations.id] }),
  brandKit: one(brandKits, { fields: [users.id], references: [brandKits.userId] }),
  campaigns: many(campaigns),
  listings: many(listings),
}))

export const campaignRelations = relations(campaigns, ({ one }) => ({
  listing: one(listings, { fields: [campaigns.listingId], references: [listings.id] }),
  agent: one(users, { fields: [campaigns.agentId], references: [users.id] }),
  brandKit: one(brandKits, { fields: [campaigns.brandKitId], references: [brandKits.id] }),
}))
export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, { fields: [subscriptions.orgId], references: [organizations.id] }),
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
}))
