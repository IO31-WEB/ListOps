/**
 * PostHog Analytics
 * Server-side event tracking for retention optimization.
 *
 * Install: npm install posthog-node
 * Add to Vercel: POSTHOG_API_KEY=phc_xxx
 *
 * Falls back to console.log if not configured (safe for dev).
 */

let posthogClient: any = null

function getClient() {
  if (posthogClient) return posthogClient
  if (!process.env.POSTHOG_API_KEY) return null

  try {
    const { PostHog } = require('posthog-node')
    posthogClient = new PostHog(process.env.POSTHOG_API_KEY, {
      host: 'https://app.posthog.com',
      flushAt: 1,   // Flush immediately on serverless
      flushInterval: 0,
    })
    return posthogClient
  } catch {
    return null
  }
}

export function trackServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
) {
  const client = getClient()
  if (!client) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[posthog] ${event}`, { distinctId, ...properties })
    }
    return
  }
  client.capture({ distinctId, event, properties })
}

// ── Typed event helpers ───────────────────────────────────────

export function trackCampaignGenerated(opts: {
  userId: string
  planTier: string
  mlsId: string
  durationMs: number
  isDemo: boolean
  contentTypes: string[]
}) {
  trackServerEvent(opts.userId, 'campaign_generated', {
    plan_tier: opts.planTier,
    mls_id: opts.mlsId,
    duration_ms: opts.durationMs,
    is_demo: opts.isDemo,
    content_types: opts.contentTypes,
    content_type_count: opts.contentTypes.length,
  })
}

export function trackPlanUpgraded(opts: {
  userId: string
  fromPlan: string
  toPlan: string
  billingInterval: 'monthly' | 'annual'
}) {
  trackServerEvent(opts.userId, 'plan_upgraded', {
    from_plan: opts.fromPlan,
    to_plan: opts.toPlan,
    billing_interval: opts.billingInterval,
    is_annual: opts.billingInterval === 'annual',
  })
}

export function trackMicrositeViewed(opts: {
  campaignId: string
  slug: string
  referrer?: string
}) {
  trackServerEvent(`microsite_${opts.campaignId}`, 'microsite_viewed', {
    campaign_id: opts.campaignId,
    slug: opts.slug,
    referrer: opts.referrer,
  })
}

export function trackReferralSignup(opts: {
  referrerId: string
  newUserId: string
  referralCode: string
}) {
  trackServerEvent(opts.referrerId, 'referral_signup', {
    new_user_id: opts.newUserId,
    referral_code: opts.referralCode,
  })
}

export function trackFlyerDownloaded(opts: {
  userId: string
  campaignId: string
  template: string
  planTier: string
}) {
  trackServerEvent(opts.userId, 'flyer_downloaded', {
    campaign_id: opts.campaignId,
    template: opts.template,
    plan_tier: opts.planTier,
  })
}
